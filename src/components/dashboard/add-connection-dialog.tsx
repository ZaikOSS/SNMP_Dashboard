
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Device, Connection, ConnectionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

const formSchema = z.object({
  source: z.string().min(1, "Source device is required."),
  target: z.string().min(1, "Target device is required."),
  sourceInterface: z.string().min(1, "Source interface is required."),
  targetInterface: z.string().min(1, "Target interface is required."),
  type: z.enum(["ethernet", "wifi", "fiber", "virtual"], {
    required_error: "Connection type is required."
  }),
}).refine(data => data.source !== data.target, {
    message: "Source and target cannot be the same.",
    path: ["target"],
});

type AddConnectionFormValues = z.infer<typeof formSchema>;

interface AddConnectionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  devices: Device[];
  connections: Connection[];
  onAddConnection: (connection: Omit<Connection, 'id'>) => void;
}

export function AddConnectionDialog({ isOpen, onOpenChange, devices, connections, onAddConnection }: AddConnectionDialogProps) {
  const { toast } = useToast();
  
  const form = useForm<AddConnectionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      target: "",
      sourceInterface: "",
      targetInterface: "",
      type: "ethernet",
    },
  });

  const sourceDeviceId = form.watch("source");
  const targetDeviceId = form.watch("target");

  const sourceDevice = devices.find(d => d.id === Number(sourceDeviceId));
  const targetDevice = devices.find(d => d.id === Number(targetDeviceId));

  useEffect(() => {
    // Reset interface fields when device changes
    form.resetField("sourceInterface");
    form.resetField("targetInterface");
  }, [sourceDeviceId, targetDeviceId, form]);


  const onSubmit = (values: AddConnectionFormValues) => {
    const sourceId = Number(values.source);
    const targetId = Number(values.target);

    // Check if connection already exists
    const connectionExists = connections.some(c => 
        (c.source_device_id === sourceId && c.target_device_id === targetId) ||
        (c.source_device_id === targetId && c.target_device_id === sourceId)
    );

    if (connectionExists) {
        toast({
            title: "Connection Exists",
            description: "A connection between these devices already exists.",
            variant: "destructive",
        })
        return;
    }

    onAddConnection({
        source_device_id: sourceId,
        target_device_id: targetId,
        source_interface: values.sourceInterface,
        target_interface: values.targetInterface,
        type: values.type as ConnectionType
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Add New Connection</DialogTitle>
          <DialogDescription>
            Select two devices and their interfaces to create a network link.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                <div className="space-y-2">
                    <FormField
                        control={form.control}
                        name="source"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Source Device</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select device..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {devices.map(device => (
                                    <SelectItem key={device.id} value={String(device.id)}>
                                        {device.hostname}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="sourceInterface"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Source Interface</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value} disabled={!sourceDevice}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select interface..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {sourceDevice?.interfaces.map(iface => (
                                    <SelectItem key={`${sourceDevice.id}-${iface.ifDescr}`} value={iface.ifDescr}>
                                        {iface.ifDescr} ({iface.ifType || 'N/A'})
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground"/>
                <div className="space-y-2">
                    <FormField
                        control={form.control}
                        name="target"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Target Device</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select device..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {devices.map(device => (
                                    <SelectItem key={device.id} value={String(device.id)}>
                                        {device.hostname}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="targetInterface"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Target Interface</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!targetDevice}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select interface..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {targetDevice?.interfaces.map(iface => (
                                     <SelectItem key={`${targetDevice.id}-${iface.ifDescr}`} value={iface.ifDescr}>
                                        {iface.ifDescr} ({iface.ifType || 'N/A'})
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </div>
             <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Connection Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a connection type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="ethernet">Ethernet (Wired)</SelectItem>
                            <SelectItem value="wifi">Wi-Fi (Wireless)</SelectItem>
                            <SelectItem value="fiber">Fiber Optic</SelectItem>
                            <SelectItem value="virtual">Virtual</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Create Connection</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
