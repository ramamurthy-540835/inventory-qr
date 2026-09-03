const form = document.querySelector('#registration-form');
const message = document.querySelector('#form-message');
const required = ['customer_name', 'phone_number', 'address', 'postal_code', 'city', 'state'];
const value = id => document.querySelector(`#${id}`).value.trim();

function error(id, text) {
  const el = document.querySelector(`#${id}`);
  const group = el.closest('.field-group');
  group?.classList.toggle('invalid', Boolean(text));
  const hint = group?.querySelector('.field-error'); if (hint) hint.textContent = text || '';
}
form.addEventListener('submit', async event => {
  event.preventDefault(); message.textContent = ''; message.className = 'form-message';
  let valid = true;
  required.forEach(id => { const missing = !value(id); error(id, missing ? 'This field is required.' : ''); valid &&= !missing; });
  const phone = value('phone_number').replace(/\D/g, '');
  if (phone && !/^\d{10}$/.test(phone)) { error('phone_number', 'Enter a valid 10-digit mobile number.'); valid = false; }
  const pin = value('postal_code'); if (pin && !/^\d{6}$/.test(pin)) { error('postal_code', 'Enter a valid 6-digit PIN code.'); valid = false; }
  const email = value('email'); if (email && !/^\S+@\S+\.\S+$/.test(email)) { error('email', 'Enter a valid email address.'); valid = false; }
  if (!document.querySelector('#terms').checked) { message.textContent = 'Please accept the Terms of Use and Privacy Policy.'; message.classList.add('error'); valid = false; }
  if (!valid) return;
  const button = form.querySelector('button'); button.disabled = true; button.querySelector('span').textContent = 'Creating account…';
  const payload = Object.fromEntries(new FormData(form)); payload.phone_number = `+91${phone}`;
  try {
    const response = await fetch('/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to create your account.');
    localStorage.setItem('nelture-customer', JSON.stringify(body));
    form.reset(); message.textContent = 'Welcome to Nelture! Opening your grocery account...'; message.classList.add('success');
    window.setTimeout(() => window.location.assign('/app/'), 900);
  } catch (err) { message.textContent = err.message; message.classList.add('error'); }
  finally { button.disabled = false; button.querySelector('span').textContent = 'Create account'; }
});
