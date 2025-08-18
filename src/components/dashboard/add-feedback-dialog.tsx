"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  problem: z
    .string()
    .min(10, "Problem description must be at least 10 characters."),
  troubleshooting: z.string().optional(),
  solution: z.string().optional(),
});

type AddFeedbackFormValues = z.infer<typeof formSchema>;

interface AddFeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (
    problem: string,
    troubleshooting?: string,
    solution?: string
  ) => void;
}

export function AddFeedbackDialog({
  isOpen,
  onOpenChange,
  onSubmit,
}: AddFeedbackDialogProps) {
  const form = useForm<AddFeedbackFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      problem: "",
      troubleshooting: "",
      solution: "",
    },
  });

  const handleSubmit = (values: AddFeedbackFormValues) => {
    onSubmit(values.problem, values.troubleshooting, values.solution);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Describe the issue you encountered and any steps you took to resolve
            it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 pt-4"
          >
            <FormField
              control={form.control}
              name="problem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Problem Description{" "}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the issue in detail..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="troubleshooting"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Troubleshooting Steps (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What steps did you take to diagnose the problem?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="solution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solution / Resolution (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="How was the issue resolved? What was the final solution?"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Submit Feedback</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
