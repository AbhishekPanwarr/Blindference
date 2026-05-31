import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/helpers';
import { ChevronDown, Zap, AlertTriangle, Info, Lightbulb, Check, Copy } from 'lucide-react';

// ─── Card / CardGroup ───

interface CardProps {
  title?: string;
  icon?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  server: <Zap className="w-5 h-5" />,
  cpu: <Zap className="w-5 h-5" />,
  code: <Zap className="w-5 h-5" />,
  lock: <Zap className="w-5 h-5" />,
  shield: <Zap className="w-5 h-5" />,
  users: <Zap className="w-5 h-5" />,
  coins: <Zap className="w-5 h-5" />,
  book: <Zap className="w-5 h-5" />,
  rocket: <Zap className="w-5 h-5" />,
  globe: <Zap className="w-5 h-5" />,
  file: <Zap className="w-5 h-5" />,
  default: <Zap className="w-5 h-5" />,
};

export function Card({ title, icon, href, children, className }: CardProps) {
  const content = (
    <div
      className={cn(
        "group relative rounded-2xl bg-[rgba(10,10,10,0.6)] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 hover:border-white/[0.2] hover:shadow-[0_0_30px_rgba(249,115,22,0.1)]",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10 p-6">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 text-violet-400">
            {iconMap[icon] || iconMap.default}
          </div>
        )}
        {title && <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>}
        <div className="text-white/60 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {content}
      </a>
    );
  }

  return content;
}

interface CardGroupProps {
  cols?: number;
  children: React.ReactNode;
  className?: string;
}

export function CardGroup({ cols = 2, children, className }: CardGroupProps) {
  return (
    <div className={cn(
      "grid gap-4 my-6",
      cols === 1 && "grid-cols-1",
      cols === 2 && "grid-cols-1 md:grid-cols-2",
      cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      className
    )}>
      {children}
    </div>
  );
}

// ─── Steps ───

interface StepProps {
  title?: string;
  icon?: string;
  children: React.ReactNode;
}

export function Step({ title, children }: StepProps) {
  return (
    <div className="relative pl-8 pb-8 last:pb-0">
      <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-violet-400" />
      </div>
      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-white/10" />
      {title && <h4 className="text-white font-semibold mb-2">{title}</h4>}
      <div className="text-white/60 text-sm">{children}</div>
    </div>
  );
}

interface StepsProps {
  children: React.ReactNode;
  className?: string;
}

export function Steps({ children, className }: StepsProps) {
  return (
    <div className={cn("my-6", className)}>
      {children}
    </div>
  );
}

// ─── Tabs ───

interface TabProps {
  title: string;
  children: React.ReactNode;
}

export function Tab({ children }: TabProps) {
  return <div>{children}</div>;
}

interface TabsProps {
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ children, className }: TabsProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const tabs = React.Children.toArray(children) as React.ReactElement<TabProps>[];

  return (
    <div className={cn("my-6", className)}>
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-4 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              activeIndex === i
                ? "bg-white/[0.08] text-white border border-white/10"
                : "text-white/40 hover:text-white/70"
            )}
          >
            {tab.props.title}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tabs[activeIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Accordion ───

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Accordion({ title, children, defaultOpen = false, className }: AccordionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("my-4 rounded-2xl bg-[rgba(10,10,10,0.6)] backdrop-blur-xl border border-white/[0.08] overflow-hidden", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-white font-medium text-sm">{title}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 text-white/60 text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Callouts ───

interface CalloutProps {
  children: React.ReactNode;
  className?: string;
}

const calloutStyles = {
  note: "border-l-4 border-blue-500/50 bg-blue-500/5",
  tip: "border-l-4 border-green-500/50 bg-green-500/5",
  warning: "border-l-4 border-yellow-500/50 bg-yellow-500/5",
  info: "border-l-4 border-violet-500/50 bg-violet-500/5",
};

const calloutIcons = {
  note: <Info className="w-4 h-4 text-blue-400" />,
  tip: <Lightbulb className="w-4 h-4 text-green-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  info: <Zap className="w-4 h-4 text-violet-400" />,
};

function Callout({ type, children, className }: CalloutProps & { type: keyof typeof calloutStyles }) {
  return (
    <div className={cn("my-6 rounded-r-xl p-4", calloutStyles[type], className)}>
      <div className="flex items-start gap-3">
        {calloutIcons[type]}
        <div className="text-white/70 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function Note(props: CalloutProps) { return <Callout type="note" {...props} />; }
export function Tip(props: CalloutProps) { return <Callout type="tip" {...props} />; }
export function Warning(props: CalloutProps) { return <Callout type="warning" {...props} />; }
export function InfoCallout(props: CalloutProps) { return <Callout type="info" {...props} />; }

// ─── CodeBlock ───

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  children: string;
  className?: string;
  title?: string;
}

export function CodeBlock({ children, className, title }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const language = className?.replace('language-', '') || 'text';
  const code = typeof children === 'string' ? children : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-white/[0.06] bg-[#08080a]">
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.015] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="h-[9px] w-[9px] rounded-full bg-[#ff5f57]" />
            <div className="h-[9px] w-[9px] rounded-full bg-[#febc2e]" />
            <div className="h-[9px] w-[9px] rounded-full bg-[#28c840]" />
          </div>
          {title && (
            <span className="text-[11px] font-semibold text-gray-400 tracking-wide">
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-gray-600">{language}</span>
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-all ${
              copied
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
            }`}
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem 1.25rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.7',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// ─── Table ───

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className={cn("w-full text-sm border-collapse", className)}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-white/[0.12]">{children}</thead>;
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-white/[0.06]">{children}</tbody>;
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>;
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-xs font-semibold text-white/50 uppercase tracking-wider">{children}</th>;
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-white/70">{children}</td>;
}

// ─── Mermaid ───

interface MermaidProps {
  children: string;
}

export function Mermaid({ children }: MermaidProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      import('mermaid').then((mermaid) => {
        mermaid.default.initialize({
          theme: 'dark',
          themeVariables: {
            primaryColor: '#8B5CF6',
            primaryTextColor: '#fff',
            primaryBorderColor: '#8B5CF6',
            lineColor: '#666',
            secondaryColor: '#1a1a1a',
            tertiaryColor: '#0a0a0a',
          },
        });
        mermaid.default.run({ nodes: [ref.current!] });
      });
    }
  }, [children]);

  return (
    <div className="my-6 rounded-2xl bg-[#0a0a0a] border border-white/[0.08] p-6 overflow-x-auto">
      <div ref={ref} className="mermaid">
        {children}
      </div>
    </div>
  );
}

// ─── Copy Button (shared) ───

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
        copied
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] hover:text-gray-300'
      }`}
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ─── Pre wrapper for fenced code blocks ───

function MacCodeBlock({ code, language, title }: { code: string; language: string; title?: string }) {
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-white/[0.06] bg-[#08080a]">
      <div className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.015] px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-[9px] w-[9px] rounded-full bg-[#ff5f57]" />
            <div className="h-[9px] w-[9px] rounded-full bg-[#febc2e]" />
            <div className="h-[9px] w-[9px] rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wide">
            {title || ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-600">{language}</span>
          <CopyButton code={code} />
        </div>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem 1.25rem',
            background: 'transparent',
            fontSize: '13px',
            lineHeight: '1.7',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function Pre({ children, title: preTitle, ...props }: React.HTMLProps<HTMLPreElement> & { title?: string }) {
  // Extract code element from children
  let code = '';
  let language = 'text';
  let title = preTitle || '';

  const extractCode = (child: React.ReactNode) => {
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement;
      if (el.type === 'code') {
        const codeProps = el.props as { className?: string; children?: React.ReactNode; title?: string };
        language = codeProps.className?.replace('language-', '') || 'text';
        title = title || codeProps.title || '';
        code = typeof codeProps.children === 'string' ? codeProps.children : '';
        return true;
      }
    }
    return false;
  };

  if (React.isValidElement(children) && extractCode(children)) {
    // Single code child
  } else if (Array.isArray(children)) {
    for (const child of children) {
      if (extractCode(child)) break;
    }
  }

  // If we found a code block with language, render Mac-style
  if (code && language !== 'text') {
    return <MacCodeBlock code={code} language={language} title={title} />;
  }

  // Fallback for plain pre blocks (no language)
  return <pre {...props}>{children}</pre>;
}

// ─── Inline code wrapper ───

export function InlineCode({ children, className }: { children: React.ReactNode; className?: string }) {
  // If this is a code block (language-* class), return plain code to avoid double-styling
  if (className?.startsWith('language-')) {
    return <code className={className}>{children}</code>;
  }

  // Inline code styling
  return (
    <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-violet-300 text-sm font-mono">
      {children}
    </code>
  );
}

// ─── MDX Components Map ───

export const mdxComponents = {
  Card,
  CardGroup,
  Step,
  Steps,
  Tab,
  Tabs,
  Accordion,
  Note,
  Tip,
  Warning,
  Info: InfoCallout,
  CodeBlock,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Mermaid,
  pre: Pre,
  code: InlineCode,
};
