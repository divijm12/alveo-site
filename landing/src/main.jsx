import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
// Dev stages for working on one piece alone: ?view=vape | ?view=sections
const view = new URLSearchParams(location.search).get("view");
const root = createRoot(document.getElementById("root"));
if (view === "vape") import("./dev/VapeStage.jsx").then(m => root.render(<m.default />));
else if (view === "sections") import("./dev/SectionsStage.jsx").then(m => root.render(<m.default />));
else root.render(<App />);
