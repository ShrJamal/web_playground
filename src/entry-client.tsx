import { hydrate } from "solid-js/web"
import "./assets/global.css"
import App from "./app"

hydrate(() => <App />, document.querySelector("#app")!)
