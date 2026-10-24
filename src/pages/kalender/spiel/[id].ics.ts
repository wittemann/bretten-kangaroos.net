// One game as a calendar file, for "In meinen Kalender" → Apple, Outlook & andere
import type { APIRoute } from "astro";
import { calendar, gamesFor, gameTitle, icsResponse } from "@/lib/calendar";

export function getStaticPaths() {
  return gamesFor().map((game) => ({ params: { id: String(game.id) }, props: { game } }));
}

export const GET: APIRoute = ({ props, site }) =>
  icsResponse(calendar(gameTitle(props.game), [props.game], site!.origin));
