"use client";

import { useState, useEffect, useCallback } from "react";
import { Feedback } from "@/types";
import * as api from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, UserCircle, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AddFeedbackDialog } from "./add-feedback-dialog";
import { DeleteFeedbackDialog } from "./delete-feedback-dialog";
import { format } from "date-fns";

export function FeedbackList() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );
  const { toast } = useToast();

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const feedbackData = await api.getFeedback();
      setFeedback(feedbackData);
    } catch (error: any) {
      toast({
        title: "Failed to fetch feedback",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleAddFeedback = async (
    problem: string,
    troubleshooting?: string,
    solution?: string
  ) => {
    try {
      await api.createFeedback(problem, troubleshooting, solution);
      toast({
        title: "Feedback Submitted",
        description: "Thank you for your feedback!",
      });
      fetchFeedback(); // Refetch for everyone
    } catch (error: any) {
      toast({
        title: "Failed to submit feedback",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteFeedback = async (feedbackId: number) => {
    try {
      await api.deleteFeedback(feedbackId);
      toast({
        title: "Feedback Deleted",
        description: "The feedback entry has been removed.",
      });
      setFeedback((prev) => prev.filter((f) => f.id !== feedbackId));
    } catch (error: any) {
      toast({
        title: "Failed to delete feedback",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (item: Feedback) => {
    setSelectedFeedback(item);
    setIsDeleteOpen(true);
  };

  const isAdmin = user?.role === "admin";

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setIsAddOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Feedback
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.length === 0 ? (
            <Card className="text-center py-12">
              <CardHeader>
                <CardTitle>No Feedback Yet</CardTitle>
                <CardDescription>
                  Be the first to submit feedback or report an issue.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            feedback.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">Problem</CardTitle>
                      <CardDescription>{item.problem}</CardDescription>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(item)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.troubleshooting && (
                    <div>
                      <h4 className="font-semibold">Troubleshooting Steps</h4>
                      <p className="text-muted-foreground">
                        {item.troubleshooting}
                      </p>
                    </div>
                  )}
                  {item.solution && (
                    <div>
                      <h4 className="font-semibold">Solution/Resolution</h4>
                      <p className="text-muted-foreground">{item.solution}</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground flex justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Submitted by: {item.username}</span>
                  </div>
                  <span>{format(new Date(item.timestamp), "PPP p")}</span>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      <AddFeedbackDialog
        isOpen={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSubmit={handleAddFeedback}
      />

      {selectedFeedback && isAdmin && (
        <DeleteFeedbackDialog
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          feedback={selectedFeedback}
          onConfirmDelete={() => handleDeleteFeedback(selectedFeedback.id)}
        />
      )}
    </>
  );
}
