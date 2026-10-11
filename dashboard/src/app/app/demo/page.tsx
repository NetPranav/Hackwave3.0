import DemoControl from "@/components/dashboard/demo/DemoControl";

// v2-P4.2: flips the fake providers during a demo (DEMO_MODE only; the API route refuses otherwise).
export default function DemoPage() {
  return <DemoControl />;
}
