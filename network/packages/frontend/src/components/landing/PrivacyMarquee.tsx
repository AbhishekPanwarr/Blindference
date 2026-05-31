import { motion } from "framer-motion";
import { fadeInUp, staggerSlow } from "../../lib/animations";

interface MarqueeCard {
  source: string;
  title: string;
  excerpt: string;
}

const cards: MarqueeCard[] = [
  {
    source: "TechCrunch",
    title: "Sam Altman warns there's no legal confidentiality when using ChatGPT as a therapist",
    excerpt: "OpenAI's CEO admits conversations may be reviewed, used for training, or shared with third parties.",
  },
  {
    source: "TechCrunch",
    title: "ChatGPT hit with privacy complaint over defamatory hallucinations",
    excerpt: "EU privacy body weighs in on tricky GenAI lawfulness questions after false personal data generated.",
  },
  {
    source: "TechCrunch",
    title: "Anthropic users face a new choice – opt out or share your chats for AI training",
    excerpt: "Claude users must explicitly opt out or their conversations will be used to improve Anthropic's models.",
  },
  {
    source: "Wired",
    title: "The latest viral ChatGPT trend is doing 'reverse location search' from photos",
    excerpt: "Users discovered ChatGPT can extract precise GPS coordinates from uploaded images without consent.",
  },
  {
    source: "TechCrunch",
    title: "Why does the name 'David Mayer' crash ChatGPT? OpenAI says privacy tool went rogue",
    excerpt: "A privacy protection system malfunctioned and blocked legitimate queries, raising questions about control.",
  },
  {
    source: "The Guardian",
    title: "Elon Musk threatens to ban Apple devices over ChatGPT integrations",
    excerpt: "Apple's deep OS integration with OpenAI raises concerns about data flowing to external AI without user knowledge.",
  },
  {
    source: "TechCrunch",
    title: "Amazon acquires Bee, the AI wearable that records everything you say",
    excerpt: "Continuous audio recording by AI wearables creates unprecedented privacy risks for users.",
  },
];

const row1 = cards;
const row2 = [...cards].reverse();

function getSourceColor(source: string) {
  switch (source) {
    case "TechCrunch":
      return "bg-orange-500";
    case "Wired":
      return "bg-blue-500";
    case "The Guardian":
      return "bg-emerald-500";
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
          <div
            key={`${card.title}-${i}`}
            className="w-[340px] shrink-0 bg-[#080808]/80 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.15] group"
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
          </div>
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
