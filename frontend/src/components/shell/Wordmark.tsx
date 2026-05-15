interface Props {
  size?: "sm" | "md";
  withMark?: boolean;
}

export function Wordmark({ size = "sm", withMark = true }: Props) {
  const px = size === "md" ? 28 : 22;
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
      <span
        className={
          size === "md"
            ? "text-lg font-semibold tracking-tight"
            : "text-[15px] font-semibold tracking-tight"
        }
      >
        klin <span className="text-accent-600">AI</span>
      </span>
    </div>
  );
}
