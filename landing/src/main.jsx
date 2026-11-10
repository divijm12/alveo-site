import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
// Dev stage for working on the product sections alone: ?view=sections
const view = new URLSearchParams(location.search).get("view");
const root = createRoot(document.getElementById("root"));
if (view === "sections") import("./dev/SectionsStage.jsx").then(m => root.render(<m.default />));
else root.render(<App />);
