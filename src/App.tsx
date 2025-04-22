import { Refine } from "@refinedev/core";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import routerProvider from "@refinedev/react-router-v6";

const App = () => {
  console.log("Rendering App component...");

  return (
    <BrowserRouter>
      <div style={{ padding: "2rem", textAlign: "center", fontSize: "2rem" }}>
        <p>App mounted before Refine</p>
      </div>

      <Refine
        routerProvider={routerProvider}
        options={{
          syncWithLocation: true,
        }}
      >
        <Routes>
          <Route path="/" element={<h1>Refine is working!</h1>} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
};

export default App;