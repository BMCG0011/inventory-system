import * as React from "react";
import type { FieldValues, FieldPath } from "react-hook-form";
import type { FormItemContextValue } from "./form";

export const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);
export interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}
export const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);
