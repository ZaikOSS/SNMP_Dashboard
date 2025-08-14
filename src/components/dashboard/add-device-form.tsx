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
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PlusCircle, Loader2 } from "lucide-react";
import { useNetwork } from "@/contexts/network-context";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useState } from "react";
import * as api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DeviceType } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const formSchema = z.object({
  ipAddress: z.string().ip({ message: "Invalid IP address." }),
  deviceType: z.enum(["router", "switch", "server", "pc", "firewall"], {
    required_error: "Device type is required.",
  }),
});

type AddDeviceFormValues = z.infer<typeof formSchema>;

const getSubnet = (ip: string) => ip.split(".").slice(0, 3).join(".");

export function AddDeviceForm() {
  const { devices, addDevice } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddDeviceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ipAddress: "",
    },
  });

  const onSubmit = async (values: AddDeviceFormValues) => {
    setIsLoading(true);

    if (devices.length > 0) {
      const networkSubnet = getSubnet(devices[0].ip);
      const newDeviceSubnet = getSubnet(values.ipAddress);
      if (networkSubnet !== newDeviceSubnet) {
        toast({
          title: "Network Mismatch",
          description:
            "New device must be on the same network subnet as existing devices.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }

    try {
      const result = await api.scanDevice(values.ipAddress);
      // Manually override device type with user's selection
      const finalDevice = {
        ...result.data,
        deviceType: values.deviceType as DeviceType,
      };
      addDevice(finalDevice);
      toast({
        title: "Device Scanned Successfully",
        description: `Added ${result.data.hostname} to the device list.`,
      });
      form.reset();
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Device via SNMP
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <p className="text-sm font-medium">Scan New Device</p>
            <FormField
              control={form.control}
              name="ipAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Address</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 192.168.1.100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a device type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="router">Router</SelectItem>
                      <SelectItem value="switch">Switch</SelectItem>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="pc">PC</SelectItem>
                      <SelectItem value="firewall">Firewall</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Scan and Add
            </Button>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  );
}
