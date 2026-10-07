"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/store";
import TopBar from "./TopBar";
import FxLayer from "./FxLayer";
import Home from "./Home";
import Create from "./Create";
import SetView from "./SetView";
import Editor from "./Editor";
import Profile from "./Profile";
import Study from "./Study";
import Account from "./Account";
import { startSync } from "@/lib/sync";

export type Route =
  | { name: "home" }
  | { name: "create"; tab?: string }
  | { name: "profile" }
  | { name: "account" }
  | { name: "set"; id: string }
  | { name: "edit"; id: string }
  | { name: "study"; id: string; mode: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0]?.startsWith("create")) return { name: "create", tab: parts[0].split("?")[1] };
  if (parts[0] === "profile") return { name: "profile" };
  if (parts[0] === "account") return { name: "account" };
  if (parts[0] === "set" && parts[1]) {
    if (parts[2] === "edit") return { name: "edit", id: parts[1] };
    if (parts[2]) return { name: "study", id: parts[1], mode: parts[2] };
    return { name: "set", id: parts[1] };
  }
  return { name: "home" };
}

export function go(path: string) {
  window.location.hash = path.startsWith("/") ? path : "/" + path;
}

export default function App() {
  const hydrated = useHydrated();
  const [route, setRoute] = useState<Route>({ name: "home" });

  useEffect(() => {
    const update = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    update();
    void startSync();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  if (!hydrated) return <div style={{ minHeight: "100vh" }} />;

  return (
    <>
      <TopBar route={route} />
      <main className="container" key={JSON.stringify(route)}>
        {route.name === "home" && <Home />}
        {route.name === "create" && <Create initialTab={route.tab} />}
        {route.name === "profile" && <Profile />}
        {route.name === "account" && <Account />}
        {route.name === "set" && <SetView id={route.id} />}
        {route.name === "edit" && <Editor id={route.id} />}
        {route.name === "study" && <Study id={route.id} mode={route.mode} />}
      </main>
      <footer className="footer">Acuity</footer>
      <FxLayer />
    </>
  );
}
