import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/features/lp/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Casa de Saúde São Lucas" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  component: Landing,
});
