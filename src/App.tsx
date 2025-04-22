import { Refine } from "@refinedev/core";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import routerProvider from "@refinedev/react-router-v6";

const App = () => {
  return (
    <BrowserRouter>
      <Refine
        routerProvider={routerProvider}
        options={{
          syncWithLocation: true,
        }}
      >
        <Routes>
          <Route path="/" element={<h1 style={{ padding: "3rem" }}>Refine is rendering!</h1>} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
};

export default App;

