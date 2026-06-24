import { Game } from "./game/controller"

const root = document.getElementById("root")
if (root) {
  new Game(root)
}
