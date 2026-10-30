import type { Metadata } from "next";
import PitchDeck from "@/components/deck/PitchDeck";

export const metadata: Metadata = {
  title: "Seismo · Team XERO",
  description: "Seismo pitch deck, HackWave 3.0.",
};

export default function DeckPage() {
  return <PitchDeck />;
}
