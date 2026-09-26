import Link from "next/link";
import { ShowroomFooter } from "@/components/site/shop-footer";

export default function ShowroomNotFound() {
  return (
    <>
      <main className="showroom-page is-ready" id="main-content" data-showroom="">
        <div className="showroom-not-found">
          <span className="showroom-eyebrow">Showroom unavailable</span>
          <h1>This artwork could not be found.</h1>
          <Link href="/collection">Return to the collection</Link>
        </div>
      </main>
      <ShowroomFooter />
    </>
  );
}
