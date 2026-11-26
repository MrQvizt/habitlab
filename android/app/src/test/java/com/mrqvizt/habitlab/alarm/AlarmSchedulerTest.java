package com.mrqvizt.habitlab.alarm;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Calendar;
import java.util.TimeZone;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/** The next-occurrence maths that decides when every alarm rings. */
public class AlarmSchedulerTest {
    private TimeZone saved;

    @Before
    public void zone() {
        saved = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Stockholm"));
    }

    @After
    public void restore() {
        TimeZone.setDefault(saved);
    }

    private static long at(int y, int mo, int d, int h, int mi) {
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(y, mo - 1, d, h, mi, 0);
        return c.getTimeInMillis();
    }

    private static AlarmStore.Alarm alarm(int h, int m, int... days) {
        AlarmStore.Alarm a = new AlarmStore.Alarm();
        a.id = "t";
        a.hour = h;
        a.minute = m;
        if (days.length == 0) for (int i = 0; i < 7; i++) a.days[i] = true;
        for (int d : days) a.days[d] = true;
        return a;
    }

    @Test
    public void laterToday() {
        // Wednesday 25 Nov 2026, 06:00 → 07:00 the same day
        assertEquals(at(2026, 11, 25, 7, 0), AlarmScheduler.nextTrigger(alarm(7, 0), at(2026, 11, 25, 6, 0)));
    }

    @Test
    public void alreadyPassedGoesToTomorrow() {
        assertEquals(at(2026, 11, 26, 7, 0), AlarmScheduler.nextTrigger(alarm(7, 0), at(2026, 11, 25, 7, 0)));
        assertEquals(at(2026, 11, 26, 7, 0), AlarmScheduler.nextTrigger(alarm(7, 0), at(2026, 11, 25, 23, 59)));
    }

    @Test
    public void weekdaysOnlySkipsTheWeekend() {
        // Friday 27 Nov after the alarm → Monday 30 Nov (Mon = 0 … Fri = 4)
        long next = AlarmScheduler.nextTrigger(alarm(6, 45, 0, 1, 2, 3, 4), at(2026, 11, 27, 8, 0));
        assertEquals(at(2026, 11, 30, 6, 45), next);
    }

    @Test
    public void sundayOnly() {
        long next = AlarmScheduler.nextTrigger(alarm(9, 30, 6), at(2026, 11, 25, 12, 0));
        assertEquals(at(2026, 11, 29, 9, 30), next);
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(next);
        assertEquals(Calendar.SUNDAY, c.get(Calendar.DAY_OF_WEEK));
    }

    @Test
    public void sameDayNextWeekWhenOnlyTodayAndPassed() {
        // Wednesday-only alarm, now Wednesday after it → next Wednesday
        assertEquals(at(2026, 12, 2, 7, 0), AlarmScheduler.nextTrigger(alarm(7, 0, 2), at(2026, 11, 25, 8, 0)));
    }

    @Test
    public void midnightAndLateEvening() {
        assertEquals(at(2026, 11, 26, 0, 0), AlarmScheduler.nextTrigger(alarm(0, 0), at(2026, 11, 25, 22, 0)));
        assertEquals(at(2026, 11, 25, 22, 15), AlarmScheduler.nextTrigger(alarm(22, 15), at(2026, 11, 25, 22, 0)));
    }

    @Test
    public void daylightSavingStartKeepsWallClockTime() {
        // Sweden springs forward on Sunday 28 March 2027 (02:00 → 03:00). A 07:00 alarm stays at 07:00.
        long next = AlarmScheduler.nextTrigger(alarm(7, 0), at(2027, 3, 27, 22, 0));
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(next);
        assertEquals(28, c.get(Calendar.DAY_OF_MONTH));
        assertEquals(7, c.get(Calendar.HOUR_OF_DAY));
        assertEquals(0, c.get(Calendar.MINUTE));
    }

    @Test
    public void daylightSavingEndKeepsWallClockTime() {
        // Clocks go back on Sunday 31 October 2027.
        long next = AlarmScheduler.nextTrigger(alarm(7, 0), at(2027, 10, 30, 22, 0));
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(next);
        assertEquals(31, c.get(Calendar.DAY_OF_MONTH));
        assertEquals(7, c.get(Calendar.HOUR_OF_DAY));
    }

    @Test
    public void alwaysInTheFutureAndWithinAWeek() {
        long now = at(2026, 11, 25, 12, 0);
        for (int d = 0; d < 7; d++) {
            for (int h = 0; h < 24; h += 5) {
                long next = AlarmScheduler.nextTrigger(alarm(h, 7, d), now);
                assertTrue(next > now);
                assertTrue(next - now <= 7L * 24 * 3600 * 1000 + 3600 * 1000);
            }
        }
    }

    @Test
    public void snoozeStepsUpAndDown() {
        assertEquals(10, AlarmActivity.step(5, 1));
        assertEquals(3, AlarmActivity.step(5, -1));
        assertEquals(1, AlarmActivity.step(1, -1));
        assertEquals(60, AlarmActivity.step(60, 1));
        assertEquals(10, AlarmActivity.step(9, 1)); // an old 9-minute setting snaps to the steps
        assertEquals(5, AlarmActivity.step(9, -1));
    }
}
