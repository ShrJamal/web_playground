import './style.css'

const images = [
  'https://images.unsplash.com/photo-1643557763588-da65ca5e33a8?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2670&q=80',
  'https://images.unsplash.com/photo-1643479530443-3fb61e53d8f9?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1287&q=80',
  'https://images.unsplash.com/photo-1591944200520-a73846478e25?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2574&q=80',
  'https://images.unsplash.com/photo-1550408484-ddd546cf4f66?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2670&q=80',
  'https://images.unsplash.com/photo-1643469840960-13b76cd2ab74?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1287&q=80',
]

const cards = document.querySelector('.cards')
const cardTitle = document.querySelector('.card-title')
if (cards) {
  cards.innerHTML = images
    .map(
      (img, i) => `
	  	<div class="card-item ${i === 0 ? 'active' : ''}"
	  		style="background-image: url(${img}) " 
			>
		</div>
	  `,
    )
    .join('')
}

const cardItems = document.querySelectorAll('.card-item')
cardItems?.forEach((card, i) => {
  card.addEventListener('click', (e) => {
    document.querySelectorAll('.card-item').forEach((card) => {
      card.classList.remove('active')
    })
    e.target?.classList.add('active')
    if (cardTitle) cardTitle.innerText = `Card ${i + 1}`
  })
})
