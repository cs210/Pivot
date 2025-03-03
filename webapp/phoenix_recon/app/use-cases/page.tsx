import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UseCases() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Use Cases</h1>
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            Real Estate Virtual Tours
          </h2>
          <p>
            Provide immersive property tours, allowing potential buyers to
            explore homes from anywhere.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            Tourism & Travel Experiences
          </h2>
          <p>
            Offer virtual visits to tourist destinations, hotels, and
            attractions.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            Construction & Architecture Documentation
          </h2>
          <p>
            Document construction progress and architectural designs in
            interactive 3D environments.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            Event & Venue Showcases
          </h2>
          <p>
            Create virtual walkthroughs of event spaces and venues for planning
            and marketing purposes.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            Educational & Training Environments
          </h2>
          <p>
            Develop immersive learning experiences and virtual training
            simulations.
          </p>
        </section>
      </div>
      <div className="mt-8">
        <Link href="/">
          <Button>Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
