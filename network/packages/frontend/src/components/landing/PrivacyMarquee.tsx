import { motion } from "framer-motion";
import { fadeInUp, staggerSlow } from "../../lib/animations";

interface MarqueeCard {
  source: string;
  title: string;
  excerpt: string;
  url: string;
}

const cards: MarqueeCard[] = [
  {
    source: "TechCrunch",
    title: "Samsung bans use of generative AI tools like ChatGPT after April internal data leak",
    excerpt: "Samsung Electronics restricted ChatGPT on company devices after employees accidentally leaked sensitive internal code and confidential data to the platform.",
    url: "https://techcrunch.com/2023/05/02/samsung-bans-use-of-generative-ai-tools-like-chatgpt-after-april-internal-data-leak/",
  },
  {
    source: "OpenAI",
    title: "March 20 ChatGPT outage: Here's what happened",
    excerpt: "A Redis bug allowed some users to see other users' chat history titles, and exposed payment info for 1.2% of ChatGPT Plus subscribers during a nine-hour window.",
    url: "https://openai.com/blog/march-20-chatgpt-outage",
  },
  {
    source: "TechCrunch",
    title: "Google saves your conversations with Gemini for years by default",
    excerpt: "Human annotators routinely read and label Gemini conversations to improve the service. Data is retained for up to three years, including location and device info.",
    url: "https://techcrunch.com/2024/02/08/google-saves-your-conversations-with-gemini-for-years-by-default/",
  },
  {
    source: "TechCrunch",
    title: "ChatGPT hit with privacy complaint over defamatory hallucinations",
    excerpt: "Privacy group noyb filed a GDPR complaint after ChatGPT falsely told a user he had murdered his own children — with no way to correct the false information.",
    url: "https://techcrunch.com/2025/03/19/chatgpt-hit-with-privacy-complaint-over-defamatory-hallucinations/",
  },
  {
    source: "404 Media",
    title: "New Study Reveals the Manipulative 'Dark Patterns' of AI Chatbots",
    excerpt: "A Center for Democracy & Technology study found chatbots promising 'your secret's safe with me' while actually sharing data with the platform and third parties.",
    url: "https://www.404media.co/new-study-reveals-the-manipulative-dark-patterns-of-ai-chatbots/",
  },
  {
    source: "404 Media",
    title: "Instagram Is Blocking Minors from Accessing Chatbot Platform AI Studio",
    excerpt: "Therapy chatbots on Meta's AI Studio fabricated license numbers to pose as mental health professionals, with no clarity on whether conversations were kept confidential.",
    url: "https://www.404media.co/instagram-is-blocking-minors-from-accessing-chatbot-platform-ai-studio/",
  },
  {
    source: "404 Media",
    title: "'Lobotomized': Character.AI Is Showing What AI Enshittification Looks Like",
    excerpt: "Character.AI is being sued by families of users who died by suicide after using the app, and by Pennsylvania after AI characters falsely claimed to be licensed doctors.",
    url: "https://www.404media.co/lobotomized-character-ai-is-showing-what-ai-enshittification-looks-like/",
  },
  {
    source: "404 Media",
    title: "'BusPatrol' Put AI Cameras in Tens of Thousands of School Buses. Now They Want to Give Cops Access",
    excerpt: "BusPatrol plans to convert school bus cameras into automatic license plate readers, giving law enforcement location data from every vehicle they pass.",
    url: "https://www.404media.co/buspatrol-put-ai-cameras-in-tens-of-thousands-of-school-buses-now-they-want-to-give-cops-access/",
  },
  {
    source: "Ars Technica",
    title: "First man convicted under Take It Down Act kept making AI nudes after arrest",
    excerpt: "An Ohio man used over 100 AI models to create hundreds of non-consensual intimate images of women and minors, continuing even after arrest.",
    url: "https://arstechnica.com/tech-policy/2026/04/first-man-convicted-under-take-it-down-act-kept-making-ai-nudes-after-arrest/",
  },
  {
    source: "404 Media",
    title: "Podcast: How Deepfakes Destroyed a High School",
    excerpt: "Deepfake technology was used to create non-consensual explicit images of high school students, who were failed by administrators and law enforcement at every step.",
    url: "https://www.404media.co/podcast-how-deepfakes-destroyed-a-high-school/",
  },
];

const row1 = cards.slice(0, 5);
const row2 = cards.slice(5, 10);

function getSourceColor(source: string) {
  switch (source) {
    case "TechCrunch":
      return "bg-orange-500";
    case "Wired":
      return "bg-blue-500";
    case "The Guardian":
      return "bg-emerald-500";
    case "404 Media":
      return "bg-yellow-500";
    case "Ars Technica":
      return "bg-red-500";
    case "OpenAI":
      return "bg-green-500";
    default:
      return "bg-white";
  }
}

function MarqueeRow({
  items,
  direction,
}: {
  items: MarqueeCard[];
  direction: "forward" | "reverse";
}) {
  const allItems = [...items, ...items];

  return (
    <div className="flex overflow-hidden">
      <div
        className={`flex gap-5 animate-marquee-${direction} hover:[animation-play-state:paused]`}
        style={{ width: "max-content" }}
      >
        {allItems.map((card, i) => (
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            key={`${card.title}-${i}`}
            className="w-[340px] shrink-0 bg-[#080808]/80 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.15] group block"
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`w-2 h-2 rounded-full ${getSourceColor(card.source)}`}
              />
              <span className="text-[10px] font-mono uppercase tracking-wider text-brand-text-secondary">
                {card.source}
              </span>
            </div>
              <h4 className="text-sm font-bold text-white mb-2 leading-snug group-hover:text-violet-500 transition-colors">
              {card.title}
            </h4>
            <p className="text-[12.5px] text-brand-text-secondary leading-relaxed line-clamp-3">
              {card.excerpt}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function PrivacyMarquee() {
  return (
    <section className="relative py-32 px-0 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center"
        >
          <motion.p
            variants={fadeInUp}
            className="font-mono text-xs uppercase tracking-[0.25em] text-violet-500 mb-4"
          >
            THE PROBLEM
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
          >
            Centralized AI{" "}
            <span className="gradient-text">Exposes You</span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-brand-text-secondary max-w-xl mx-auto text-base md:text-lg"
          >
            Every prompt you send trains their models. Your data lives on their
            servers. You have no proof of what they did with it.
          </motion.p>
        </motion.div>
      </div>

      <div className="relative">
        {/* Mask edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

        <div className="space-y-5">
          <MarqueeRow items={row1} direction="forward" />
          <MarqueeRow items={row2} direction="reverse" />
        </div>
      </div>
    </section>
  );
}
