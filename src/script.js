import './style.css'

const projects = [
  {
    name: "Grandma' Sweets",
    path: '/grandma-sweets/index.html',
  },
]

const projectDiv = document.querySelector('.projects')
projectDiv.innerHTML = `
	${projects
    .map(
      (p) => `
		  <a class="project-item" href="${p.path}">
			<h2>${p.name}</h2>
		  </a>
	  `,
    )
    .join('')}
  `
