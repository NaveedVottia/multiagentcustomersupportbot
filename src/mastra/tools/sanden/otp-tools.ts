import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { zapierMcp } from "../../../integrations/zapier-mcp.js";

// OTP generation and validation
export const sendOtp = createTool({
  id: "sendOtp",
  description: "Send OTP to customer via email or SMS",
  inputSchema: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    channel: z.enum(["email", "sms"]).default("email"),
    customerId: z.string().optional(),
    companyName: z.string().optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    otpCode: z.string().optional(),
    message: z.string(),
    expiresAt: z.string().optional()
  }),
  async execute(args: any) {
    try {
      const { email, phone, channel, customerId, companyName } = args.input || args;
      
      if (!email && !phone) {
        return {
          success: false,
          message: "Email or phone number is required"
        };
      }

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store OTP in memory/database (in production, use Redis or similar)
      // For now, we'll use a simple in-memory store
      if (!(global as any).otpStore) {
        (global as any).otpStore = new Map();
      }
      
      const otpKey = email || phone;
      (global as any).otpStore.set(otpKey, {
        code: otpCode,
        expiresAt,
        attempts: 0,
        customerId,
        companyName
      });

      // Send OTP via Zapier (email or SMS)
      if (channel === "email" && email) {
        try {
          await zapierMcp.callTool("slack_send_direct_message", {
            instructions: `Send OTP ${otpCode} to ${email} for customer ${companyName || customerId || 'unknown'}`,
            text: `Your Sanden Repair System OTP is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message.`,
            as_bot: "true"
          });
        } catch (error) {
          console.error("Failed to send email OTP:", error);
          // Fallback: just return the OTP (for testing)
        }
      } else if (channel === "sms" && phone) {
        try {
          await zapierMcp.callTool("slack_send_direct_message", {
            instructions: `Send SMS OTP ${otpCode} to ${phone} for customer ${companyName || customerId || 'unknown'}`,
            text: `SMS OTP: ${otpCode} (expires in 10 min)`,
            as_bot: "true"
          });
        } catch (error) {
          console.error("Failed to send SMS OTP:", error);
          // Fallback: just return the OTP (for testing)
        }
      }

      return {
        success: true,
        otpCode: process.env.NODE_ENV === 'development' ? otpCode : undefined, // Only show in dev
        message: `OTP sent to ${channel === 'email' ? email : phone}`,
        expiresAt
      };
    } catch (error) {
      console.error("OTP send error:", error);
      return {
        success: false,
        message: "Failed to send OTP"
      };
    }
  }
});

export const verifyOtp = createTool({
  id: "verifyOtp",
  description: "Verify OTP code entered by customer",
  inputSchema: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    otpCode: z.string().length(6),
    customerId: z.string().optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    customerId: z.string().optional(),
    companyName: z.string().optional(),
    authLevel: z.string().optional()
  }),
  async execute(args: any) {
    try {
      const { email, phone, otpCode, customerId } = args.input || args;
      
      if (!email && !phone) {
        return {
          success: false,
          message: "Email or phone number is required"
        };
      }

      const otpKey = email || phone;
      
      if (!(global as any).otpStore || !(global as any).otpStore.has(otpKey)) {
        return {
          success: false,
          message: "OTP not found or expired"
        };
      }

      const storedOtp = (global as any).otpStore.get(otpKey);
      
      // Check if OTP is expired
      if (new Date() > new Date(storedOtp.expiresAt)) {
        (global as any).otpStore.delete(otpKey);
        return {
          success: false,
          message: "OTP has expired"
        };
      }

      // Check attempts
      if (storedOtp.attempts >= 3) {
        (global as any).otpStore.delete(otpKey);
        return {
          success: false,
          message: "Too many failed attempts"
        };
      }

      // Verify OTP
      if (storedOtp.code !== otpCode) {
        storedOtp.attempts++;
        (global as any).otpStore.set(otpKey, storedOtp);
        return {
          success: false,
          message: "Invalid OTP code"
        };
      }

      // OTP verified successfully
      const verifiedCustomerId = storedOtp.customerId || customerId;
      const companyName = storedOtp.companyName;
      
      // Clean up OTP
      (global as any).otpStore.delete(otpKey);

      return {
        success: true,
        message: "OTP verified successfully",
        customerId: verifiedCustomerId,
        companyName,
        authLevel: "otp"
      };
    } catch (error) {
      console.error("OTP verification error:", error);
      return {
        success: false,
        message: "Failed to verify OTP"
      };
    }
  }
});

export const resendOtp = createTool({
  id: "resendOtp",
  description: "Resend OTP to customer",
  inputSchema: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    channel: z.enum(["email", "sms"]).default("email"),
    customerId: z.string().optional(),
    companyName: z.string().optional()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string()
  }),
  async execute(args: any) {
    try {
      const { email, phone, channel, customerId, companyName } = args.input || args;
      
      // Check if there's an existing OTP
      const otpKey = email || phone;
      if ((global as any).otpStore && (global as any).otpStore.has(otpKey)) {
        const existingOtp = (global as any).otpStore.get(otpKey);
        const timeSinceLastSent = Date.now() - new Date(existingOtp.expiresAt).getTime() + (10 * 60 * 1000);
        
        // Rate limiting: don't allow resend within 1 minute
        if (timeSinceLastSent < 60000) {
          return {
            success: false,
            message: "Please wait before requesting another OTP"
          };
        }
      }

      // Send new OTP
      return await sendOtp.execute({ input: { email, phone, channel, customerId, companyName } });
    } catch (error) {
      console.error("OTP resend error:", error);
      return {
        success: false,
        message: "Failed to resend OTP"
      };
    }
  }
});
