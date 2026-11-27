// Account: log in so your progress is saved online and comes back on a new phone. Works before
// onboarding too ("Already have an account?"), so a new phone can pull everything down.
import { esc, icon } from '../ui/dom.js';
import * as account from '../account.js';

let mode = 'login'; // 'login' | 'signup' | 'forgot'
let sent = ''; // 'confirm' | 'reset' — an email is on its way
let busy = false;
let typedEmail = ''; // kept when the screen redraws (e.g. after a wrong password)

const ago = (ms) => {
  if (!ms) return 'not yet';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const MESSAGES = {
  restored: 'Welcome back — your progress is here.',
  merged: 'Done — the progress on this phone and in your account are combined.',
  uploaded: 'Your progress is now saved to your account.',
  same: 'You’re logged in — everything is up to date.',
};

/** After logging in: bring the phone and the account together, then say what happened. */
export async function afterLogin(ctx) {
  try {
    const outcome = await account.syncNow(ctx);
    if (ctx.state.profile?.demo) ctx.toast('Logged in. Demo data isn’t saved to your account — start your own plan and it will be.');
    else ctx.toast(MESSAGES[outcome] || MESSAGES.same);
    ctx.go(ctx.state.profile ? '#/today' : '#/start');
  } catch (e) {
    ctx.toast(`Logged in, but couldn’t reach your saved data: ${e.message}`);
    ctx.rerender();
  }
}

function loggedOut(state) {
  const back = state.profile ? '#/settings' : '#/start';
  const head = `<a class="btn ghost small" href="${back}" style="margin:0 0 6px -10px">${icon('back')}${state.profile ? 'Settings' : 'Back'}</a>`;
  if (sent) {
    return `${head}<header class="page-head"><div><h1>Check your email</h1></div></header>
      <div class="card"><p style="margin-top:0">${sent === 'confirm' ? 'We sent you a link to confirm your email. Open it, then come back here and log in.' : 'If there’s an account with that email, we sent a link to choose a new password.'}</p>
      <p class="muted" style="font-size:var(--text-sm)">Nothing there after a few minutes? Check spam.</p>
      <button class="btn primary" data-action="accountMode" data-m="login">Back to log in</button></div>`;
  }
  if (mode === 'forgot') {
    return `${head}<header class="page-head"><div><h1>Forgot your password?</h1></div></header>
      <form class="card" data-form="accountForgot"><p class="muted" style="margin-top:0">We’ll email you a link to choose a new one.</p>
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email" inputmode="email" value="${esc(typedEmail)}"></label>
        <button class="btn primary block" ${busy ? 'disabled' : ''}>Send the link</button>
        <button type="button" class="btn ghost block" data-action="accountMode" data-m="login" style="margin-top:6px">Back to log in</button></form>`;
  }
  const signup = mode === 'signup';
  return `${head}<header class="page-head"><div><div class="eyebrow">Your account</div><h1>${signup ? 'Create an account' : 'Log in'}</h1></div></header>
    <p class="muted" style="margin:-8px 0 14px">${signup ? 'Save your progress online so it’s safe if you lose or change your phone.' : 'Log in to get your progress back, or to keep it saved.'}${state.profile && !state.profile.demo ? ' What’s on this phone now is kept and added to your account.' : ''}</p>
    <div class="segmented" role="tablist" aria-label="Log in or create an account" style="margin-bottom:12px"><button role="tab" class="${signup ? '' : 'on'}" aria-selected="${!signup}" data-action="accountMode" data-m="login">Log in</button><button role="tab" class="${signup ? 'on' : ''}" aria-selected="${signup}" data-action="accountMode" data-m="signup">Create account</button></div>
    <form class="card" data-form="accountSubmit">
      <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email" inputmode="email" value="${esc(typedEmail)}"></label>
      <label class="field"><span>Password${signup ? ' <span class="hint">at least 8 characters</span>' : ''}</span><input type="password" name="password" required minlength="${signup ? 8 : 1}" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      <button class="btn primary large block" ${busy ? 'disabled' : ''}>${busy ? 'One moment…' : signup ? 'Create account' : 'Log in'}</button>
      ${signup ? '' : '<button type="button" class="btn ghost block" data-action="accountMode" data-m="forgot" style="margin-top:6px">Forgot password?</button>'}
    </form>
    <p class="muted" style="font-size:var(--text-xs)">Your data is stored privately with your account and only you can read it. Your shared calendar and friends’ names stay separate.</p>`;
}

function loggedIn(state, me) {
  if (me.confirmed && !state.profile) {
    return `<header class="page-head"><div><div class="eyebrow">Your account</div><h1>Email confirmed ✓</h1></div></header>
      <div class="card"><p style="margin-top:0"><strong>${esc(me.email || 'Your account')}</strong> is ready.</p>
        <p><strong>Using the Habit Lab app on your phone?</strong> Open it and go to <em>Settings → Save your progress → Log in</em> with this email. Everything on your phone is then saved to your account.</p>
        <p class="muted" style="font-size:var(--text-sm)">Want to use Habit Lab here in the browser instead? Start below — once your phone has saved its progress, logging in here brings it all in.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn primary" href="#/start">Start here</a><button class="btn ghost" data-action="accountSync">Check for saved progress</button></div></div>`;
  }
  return `<a class="btn ghost small" href="#/settings" style="margin:0 0 6px -10px">${icon('back')}Settings</a>
    <header class="page-head"><div><div class="eyebrow">Your account</div><h1>Saved online</h1></div></header>
    <div class="card"><div class="row between nowrap"><div><strong>${esc(me.email || 'Logged in')}</strong><small class="muted" style="display:block">Last saved ${esc(ago(me.lastSync))}${me.pending ? ' · saving…' : ''}</small></div><span class="tag green">${icon('check')}On</span></div>
      <p class="muted" style="font-size:var(--text-sm)">Everything you log is saved to your account a few seconds later. Log in on a new phone to get it all back.</p>
      ${state.profile?.demo ? '<div class="notice info">Demo data isn’t saved to your account. Start your own plan and it will be.</div>' : ''}
      <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn" data-action="accountSync" ${busy ? 'disabled' : ''}>Save now</button><button class="btn ghost" data-action="accountLogout">Log out</button></div></div>
    <details class="card"><summary style="cursor:pointer"><strong>Delete my saved data</strong></summary>
      <p class="muted" style="font-size:var(--text-sm)">Removes the copy in your account. What’s on this phone stays. It’s saved again next time you log something unless you log out first.</p>
      <button class="btn ghost danger small" data-action="accountDeleteCloud">Delete the saved copy</button></details>`;
}

function newPassword() {
  return `<header class="page-head"><div><div class="eyebrow">Your account</div><h1>Choose a new password</h1></div></header>
    <form class="card" data-form="accountNewPassword"><label class="field"><span>New password <span class="hint">at least 8 characters</span></span><input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn primary block">Save password</button></form>`;
}

export default {
  render(state, params = []) {
    const me = account.current();
    if (params[0] === 'new-password' && me) return newPassword();
    return me ? loggedIn(state, me) : loggedOut(state);
  },
  actions: {
    accountMode(el, ev, ctx) {
      mode = el.dataset.m;
      sent = '';
      ctx.rerender();
    },
    async accountSubmit(form, ev, ctx, data) {
      const email = String(data.email || '').trim();
      const password = String(data.password || '');
      if (!email || !password || busy) return;
      typedEmail = email;
      busy = true;
      ctx.rerender();
      try {
        if (mode === 'signup') {
          const r = await account.signUp(email, password);
          if (r.confirm) sent = 'confirm';
        } else await account.logIn(email, password);
      } catch (e) {
        busy = false;
        ctx.rerender();
        return ctx.toast(e.message);
      }
      busy = false;
      if (account.current()) return afterLogin(ctx);
      ctx.rerender();
    },
    async accountForgot(form, ev, ctx, data) {
      busy = true;
      try {
        await account.resetPassword(String(data.email || '').trim());
        sent = 'reset';
      } catch (e) {
        ctx.toast(e.message);
      }
      busy = false;
      ctx.rerender();
    },
    async accountNewPassword(form, ev, ctx, data) {
      try {
        await account.setPassword(String(data.password || ''));
        ctx.toast('New password saved.');
        afterLogin(ctx);
      } catch (e) {
        ctx.toast(e.message);
      }
    },
    async accountSync(el, ev, ctx) {
      busy = true;
      ctx.rerender();
      try {
        const outcome = await account.syncNow(ctx);
        if (!ctx.state.profile) ctx.toast('Nothing saved in your account yet — log in in the app on your phone first.');
        else if (outcome === 'restored') {
          ctx.toast(MESSAGES.restored);
          busy = false;
          return ctx.go('#/today');
        } else ctx.toast(outcome === 'merged' ? MESSAGES.merged : 'Saved to your account.');
      } catch (e) {
        ctx.toast(e.message);
      }
      busy = false;
      ctx.rerender();
    },
    async accountLogout(el, ev, ctx) {
      if (!(await ctx.confirm('Log out on this phone? Your progress stays here and in your account.', { ok: 'Log out' }))) return;
      await account.logOut();
      mode = 'login';
      ctx.toast('Logged out');
      ctx.rerender();
    },
    async accountDeleteCloud(el, ev, ctx) {
      if (!(await ctx.confirm('Delete the copy of your data saved in your account? What’s on this phone stays.', { ok: 'Delete' }))) return;
      try {
        await account.deleteCloudCopy();
        await account.logOut();
        ctx.toast('Your saved copy is deleted and you’re logged out.');
      } catch (e) {
        ctx.toast(e.message);
      }
      ctx.rerender();
    },
  },
};
