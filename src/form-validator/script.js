import './style.scss'

const form = document.querySelector('#form')
const username = document.querySelector('#username')
const email = document.querySelector('#email')
const password = document.querySelector('#password')
const cPassword = document.querySelector('#cPassword')

form?.addEventListener('submit', (e) => {
  e.preventDefault()
  checkRequired([username, email, password, cPassword])
  if (password.value.length < 8) {
    showError(password, 'Password must be at least 8 characters')
  }
  if (password?.value !== cPassword?.value) {
    showError(cPassword, 'Passwords do not match')
  }
})

function checkRequired(inputArr) {
  for (const e of inputArr) {
    if (!e.value) {
      showError(e, `${e.name} is required`)
    } else {
      showSuccess(e)
    }
  }
}
function showError(e, msg) {
  e?.classList.add('error')
  const small = e?.parentElement?.querySelector('small')
  small?.classList.add('error')
  small.innerText = msg
}
function showSuccess(e) {
  e?.classList.remove('error')
  e?.classList.add('success')
  const small = e?.parentElement?.querySelector('small')
  small?.classList.remove('error')
}
