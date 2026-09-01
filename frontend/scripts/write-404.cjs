
const fs = require("fs");
const content = `---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="Page Not Found | 734-243-3669" description="The page you were looking for could not be found.">
  <main class="pt-32 pb-24 px-4 max-w-4xl mx-auto">
    <header class="mb-16 text-center">
      <p class="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-4">Lost pup</p>
      <h1 class="text-5xl md:text-6xl font-serif text-teal-900 mb-6">Page Not Found</h1>
      <p class="text-xl text-gray-600 leading-relaxed">
        Looks like this pup wandered off the trail! The page you were looking for is not here.
      </p>
    </header>
    <section class="text-center">
      <h2 class="text-3xl font-serif text-teal-900 mb-8">Where to next?</h2>
      <div class="flex flex-wrap justify-center gap-4">
        <a class="inline-flex items-center justify-center px-6 py-3 rounded-full bg-emerald-500 text-teal-900 font-bold uppercase tracking-wider transition-all hover:bg-emerald-400 hover:-translate-y-1" href="/">
            Back to the homepage
        </a>
        <a class="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-teal-700 text-teal-700 font-bold uppercase tracking-wider transition-all hover:bg-teal-50 hover:-translate-y-1" href="/adopt/">
            Browse adoptable pets
        </a>
      </div>
    </section>
  </main>
</BaseLayout>
`;
fs.writeFileSync("src/pages/404.astro", content, "utf8");

