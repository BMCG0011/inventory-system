import { cn, getInitials } from "@/lib/utils";

interface UserAvatarProps {
  name: string | null | undefined;
  image: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-16 w-16 text-xl",
};

export function UserAvatar({
  name,
  image,
  size = "md",
  className,
}: UserAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (image) {
    return (
      <img
        src={image}
        alt={name ?? ""}
        className={cn(
          "rounded-full object-cover shrink-0",
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0 select-none",
        sizeClass,
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
