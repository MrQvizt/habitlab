package com.mrqvizt.habitlab.alarm;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Plays an alarm sound: a melody synthesised from the spec the app sends (js/data/melodies.js — the
 * same spec the in-app preview plays), or a ringtone from the phone. Ringing alarms loop and grow
 * from quiet to full over about a minute; chimes play the pattern twice at a moderate level.
 */
public final class SoundPlayer {
    private static final int RATE = 44100;
    // Fallback: the "Sunrise" melody.
    private static final String SUNRISE = "{\"beat\":0.34,\"decay\":6.5,\"attack\":0.012,\"partials\":[[1,1],[2,0.35],[3,0.12]],\"rest\":0.9,"
        + "\"notes\":[[523.25,1],[659.25,1],[783.99,1],[880,1],[1046.5,1],[880,1],[783.99,1],[659.25,1]]}";

    private volatile boolean playing;
    private Thread thread;
    private MediaPlayer media;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable ramp;

    /**
     * @param spec {sound: 'melody'|'device'|'uri', melody:{…}, uri}
     * @param loop ring until stop() (alarm) or play twice and finish (chime)
     * @param usage AudioAttributes usage: USAGE_ALARM rings even on silent; chimes use a notification usage
     */
    public void start(Context ctx, JSONObject spec, boolean loop, int usage, Runnable onDone) {
        stop();
        playing = true;
        String kind = spec == null ? "melody" : spec.optString("sound", "melody");
        if ("device".equals(kind) || "uri".equals(kind)) {
            Uri uri = null;
            if ("uri".equals(kind)) {
                String u = spec.optString("uri", "");
                if (!u.isEmpty()) uri = Uri.parse(u);
            }
            if (uri == null) uri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_NOTIFICATION);
            if (uri != null && startMedia(ctx, uri, loop, usage, onDone)) return;
        }
        JSONObject melody = spec == null ? null : spec.optJSONObject("melody");
        try {
            if (melody == null) melody = new JSONObject(SUNRISE);
        } catch (Exception ignored) {
        }
        startSynth(melody, loop, usage, onDone);
    }

    private boolean startMedia(Context ctx, Uri uri, boolean loop, int usage, Runnable onDone) {
        try {
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            mp.setDataSource(ctx, uri);
            mp.setLooping(loop);
            mp.prepare();
            final long t0 = System.currentTimeMillis();
            if (loop) {
                mp.setVolume(0.06f, 0.06f);
                ramp = new Runnable() {
                    @Override
                    public void run() {
                        if (!playing || media == null) return;
                        float g = (float) gain(t0, true);
                        media.setVolume(g, g);
                        handler.postDelayed(this, 500);
                    }
                };
                handler.postDelayed(ramp, 500);
            } else {
                mp.setVolume(0.75f, 0.75f);
                mp.setOnCompletionListener((p) -> {
                    stop();
                    if (onDone != null) onDone.run();
                });
            }
            mp.start();
            media = mp;
            return true;
        } catch (Exception e) {
            return false; // unreadable or removed sound: fall back to a melody
        }
    }

    private static double gain(long t0, boolean crescendo) {
        if (!crescendo) return 0.75;
        double secs = (System.currentTimeMillis() - t0) / 1000.0;
        return 0.06 + 0.94 * Math.min(1.0, Math.pow(secs / 60.0, 1.6));
    }

    private void startSynth(final JSONObject m, final boolean loop, final int usage, final Runnable onDone) {
        thread = new Thread(() -> {
            AudioTrack track = null;
            try {
                double beat = m.optDouble("beat", 0.34);
                double decay = m.optDouble("decay", 6);
                double attack = Math.max(0.001, m.optDouble("attack", 0.01));
                double restSecs = m.optDouble("rest", 0.9);
                JSONArray parts = m.optJSONArray("partials");
                JSONArray notes = m.optJSONArray("notes");
                if (notes == null || notes.length() == 0) return;
                int np = parts == null ? 1 : parts.length();
                double[] mult = new double[np];
                double[] amp = new double[np];
                double ampSum = 0;
                for (int i = 0; i < np; i++) {
                    JSONArray p = parts == null ? null : parts.optJSONArray(i);
                    mult[i] = p == null ? 1 : p.optDouble(0, 1);
                    amp[i] = p == null ? 1 : p.optDouble(1, 1);
                    ampSum += amp[i];
                }
                int minBuf = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
                track = new AudioTrack.Builder()
                    .setAudioAttributes(new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(Math.max(minBuf, RATE))
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build();
                track.play();
                long t0 = System.currentTimeMillis();
                short[] rest = new short[(int) (RATE * restSecs)];
                int passes = 0;
                while (playing && (loop || passes < 2)) {
                    for (int n = 0; n < notes.length() && playing; n++) {
                        JSONArray note = notes.optJSONArray(n);
                        if (note == null) continue;
                        double f = note.optDouble(0, 0);
                        double len = beat * note.optDouble(1, 1);
                        double to = note.length() > 2 ? note.optDouble(2, f) : f;
                        int count = Math.max(1, (int) (RATE * len));
                        short[] buf = new short[count];
                        if (f > 0) {
                            double g = gain(t0, loop) * 0.85 / ampSum;
                            double[] phase = new double[np];
                            for (int i = 0; i < count; i++) {
                                double t = (double) i / RATE;
                                double freq = f + (to - f) * (t / len);
                                double env = Math.min(1.0, t / attack) * Math.exp(-decay * t);
                                double s = 0;
                                for (int k = 0; k < np; k++) {
                                    phase[k] += 2 * Math.PI * freq * mult[k] / RATE;
                                    s += amp[k] * Math.sin(phase[k]);
                                }
                                double tail = Math.min(1.0, (count - i) / (RATE * 0.008)); // no click at the end
                                buf[i] = (short) Math.max(Short.MIN_VALUE, Math.min(Short.MAX_VALUE, s * env * tail * g * Short.MAX_VALUE));
                            }
                        }
                        track.write(buf, 0, buf.length);
                    }
                    if (playing) track.write(rest, 0, rest.length);
                    passes++;
                }
            } catch (Exception ignored) {
                // audio unavailable
            } finally {
                if (track != null) {
                    try {
                        track.stop();
                    } catch (Exception ignored) {
                    }
                    track.release();
                }
                if (!loop && playing && onDone != null) handler.post(onDone);
            }
        }, "habitlab-sound");
        thread.start();
    }

    public void stop() {
        playing = false;
        if (ramp != null) handler.removeCallbacks(ramp);
        ramp = null;
        if (media != null) {
            try {
                media.stop();
            } catch (Exception ignored) {
            }
            media.release();
            media = null;
        }
        if (thread != null) {
            try {
                thread.join(600);
            } catch (InterruptedException ignored) {
            }
            thread = null;
        }
    }
}
