interface Props {
  size?: "sm" | "md" | "lg";
  withMark?: boolean;
}

export function Wordmark({ size = "md", withMark = true }: Props) {
  const px = size === "lg" ? 32 : size === "md" ? 28 : 22;
  const textClass =
    size === "lg"
      ? "text-xl font-semibold tracking-tight"
      : size === "md"
        ? "text-[17px] font-semibold tracking-tight"
        : "text-[15px] font-semibold tracking-tight";
  return (
    <div className="inline-flex items-center gap-2">
      {withMark && (
        <img
          src="/klin-mark.png"
          alt=""
          width={px}
          height={px}
          className="rounded"
          style={{ objectFit: "cover", objectPosition: "left center" }}
        />
      )}
      <span className={textClass}>
        klin <span className="text-accent-600">AI</span>
      </span>
    </div>
  );
}
