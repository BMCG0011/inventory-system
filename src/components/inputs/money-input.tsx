import { NumberInput } from "./numeric-input";

export const MoneyInput = ({
  min,
  value,
  onChange,
  className,
}: {
  min?: number;
  value: number | undefined;
  onChange?: (amountCents: number | undefined) => void;
  className?: string;
}) => (
  <NumberInput
    min={min ?? 0}
    value={value ? value / 100 : value}
    onValueChange={(value) =>
      onChange?.(value ? Math.round(value * 100) : value)
    }
    thousandSeparator=","
    fixedDecimalScale={true}
    decimalScale={2}
    prefixNode={
      <span className="flex items-center h-full pl-2 text-muted-foreground">
        $
      </span>
    }
    inputClassName="pl-5"
    className={className}
    placeholder="0.00"
  />
);
