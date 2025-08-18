import { FeedbackList } from "@/components/dashboard/feedback-list";

export default function FeedbackPage() {
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-2">User Feedback</h1>
      <p className="text-muted-foreground mb-6">
        Review user-submitted issues, troubleshooting steps, and solutions.
      </p>
      <FeedbackList />
    </div>
  );
}
