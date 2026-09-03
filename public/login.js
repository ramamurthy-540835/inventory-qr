const form = document.querySelector('#login-form');
const message = document.querySelector('#form-message');
form.addEventListener('submit', async event => {
  event.preventDefault(); message.textContent = ''; message.className = 'form-message';
  const login = form.login.value.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);
  const phone = login.replace(/\D/g, '');
  if (!isEmail && phone.length !== 10) { message.textContent = 'Enter your registered 10-digit mobile number or email address.'; message.classList.add('error'); return; }
  const button = form.querySelector('button'); button.disabled = true; button.querySelector('span').textContent = 'Signing in…';
  try {
    const response = await fetch('/customers/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login }) });
    const customer = await response.json(); if (!response.ok) throw new Error(customer.error || 'Unable to sign in.');
    localStorage.setItem('nelture-customer', JSON.stringify(customer)); window.location.assign('/app/');
  } catch (error) { message.textContent = error.message; message.classList.add('error'); button.disabled = false; button.querySelector('span').textContent = 'Sign in to account'; }
});
