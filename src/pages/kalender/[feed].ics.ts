// Subscription feeds: /kalender/<team>.ics for each BSM team, /kalender/alle.ics
import type { APIRoute } from "astro";
import { teams } from "@/lib/bsm";
import { calendar, gamesFor, icsResponse } from "@/lib/calendar";

export function getStaticPaths() {
  return [
    ...teams.map(({ slug, name }) => ({ params: { feed: slug }, props: { team: slug, name } })),
    { params: { feed: "alle" }, props: { team: undefined, name: "alle Teams" } },
  ];
}

export const GET: APIRoute = ({ props, site }) =>
  icsResponse(
    calendar(`Bretten Kangaroos – ${props.name}`, gamesFor(props.team), site!.origin),
  );
