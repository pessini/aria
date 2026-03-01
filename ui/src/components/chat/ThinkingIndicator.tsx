export default function ThinkingIndicator() {
  return (
    <div className="flex justify-start py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <span className="animate-bounce [animation-delay:0ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        <span className="animate-bounce [animation-delay:150ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        <span className="animate-bounce [animation-delay:300ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        <span className="ml-1 text-xs">Thinking...</span>
      </div>
    </div>
  );
}
