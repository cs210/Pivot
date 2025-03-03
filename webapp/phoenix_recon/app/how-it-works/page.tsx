import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HowItWorks() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">How It Works</h1>
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            1. Upload Your 360° Video
          </h2>
          <p>
            Simply upload your 360° video footage through our secure platform.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">
            2. Automatic Processing
          </h2>
          <p>
            Our advanced system converts your videos into navigable 3D
            environments.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold mb-3">3. Explore in VR</h2>
          <p>
            Access and interact with your newly created VR environments on any
            compatible device.
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
