/**
 * WhatsApp Chat Parser
 * Parses exported WhatsApp chat files (.txt format)
 */

const fs = require('fs');
const path = require('path');

class WhatsAppChatParser {
  /**
   * Parse exported WhatsApp chat file (.txt format)
   * WhatsApp exported format example:
   * [01/01/2024, 10:30:45] John Doe: Message text
   * [01/01/2024, 10:31:00] Jane Smith: Another message
   * 
   * @param {string} filePath - Path to exported chat file
   * @returns {Promise<Array>} Parsed messages
   */
  async parseExportedFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Chat file not found: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const messages = [];
    let currentMessage = null;
    
    // Date patterns: [DD/MM/YYYY, HH:MM:SS] or [MM/DD/YYYY, HH:MM:SS AM/PM]
    const datePattern = /^\[(\d{1,2}\/\d{1,2}\/\d{4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]/;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if line starts with date pattern (new message)
      const match = trimmedLine.match(datePattern);
      
      if (match) {
        // Save previous message if exists
        if (currentMessage) {
          messages.push(currentMessage);
        }
        
        // Parse new message
        const dateStr = match[1];
        const timeStr = match[2];
        const remainingText = trimmedLine.substring(match[0].length).trim();
        
        // Extract sender name and message text
        const colonIndex = remainingText.indexOf(':');
        if (colonIndex === -1) continue;
        
        const senderName = remainingText.substring(0, colonIndex).trim();
        const messageText = remainingText.substring(colonIndex + 1).trim();
        
        // Parse date and time
        const timestamp = this.parseDateTime(dateStr, timeStr);
        
        currentMessage = {
          timestamp: timestamp,
          senderName: senderName,
          messageText: messageText,
          rawLine: trimmedLine
        };
      } else if (currentMessage) {
        // Continuation of previous message (multiline)
        currentMessage.messageText += '\n' + trimmedLine;
      }
    }
    
    // Add last message
    if (currentMessage) {
      messages.push(currentMessage);
    }
    
    return messages;
  }
  
  /**
   * Parse date and time strings into Date object
   * @param {string} dateStr - Date string (DD/MM/YYYY or MM/DD/YYYY)
   * @param {string} timeStr - Time string (HH:MM:SS or HH:MM AM/PM)
   * @returns {Date} Parsed date
   */
  parseDateTime(dateStr, timeStr) {
    // Try DD/MM/YYYY format first
    let parts = dateStr.split('/');
    let day, month, year;
    
    if (parts.length === 3) {
      // Assume DD/MM/YYYY (European format)
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      year = parseInt(parts[2], 10);
      
      // If day > 12, definitely DD/MM/YYYY
      // Otherwise, try to infer from context
      if (day > 12 && month <= 12) {
        // Definitely DD/MM/YYYY
      } else if (month > 12 && day <= 12) {
        // Must be MM/DD/YYYY, swap
        [day, month] = [month + 1, day - 1];
      }
    }
    
    // Parse time
    let hours, minutes, seconds = 0;
    const timeParts = timeStr.split(':');
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1], 10);
    
    if (timeParts.length > 2) {
      const secPart = timeParts[2];
      const ampmMatch = secPart.match(/(\d+)\s*([AP]M)/i);
      if (ampmMatch) {
        seconds = parseInt(ampmMatch[1], 10);
        const ampm = ampmMatch[2].toUpperCase();
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      } else {
        seconds = parseInt(secPart, 10);
      }
    } else if (timeStr.match(/[AP]M/i)) {
      // Handle HH:MM AM/PM format
      const ampmMatch = timeStr.match(/(\d+):(\d+)\s*([AP]M)/i);
      if (ampmMatch) {
        hours = parseInt(ampmMatch[1], 10);
        minutes = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }
    
    return new Date(year, month, day, hours, minutes, seconds);
  }
  
  /**
   * Parse exported chat and extract messages for a specific phone number
   * @param {string} filePath - Path to exported chat file
   * @param {string} phoneNumber - Phone number to filter by (optional)
   * @returns {Promise<Array>} Filtered messages
   */
  async parseForNumber(filePath, phoneNumber = null) {
    const messages = await this.parseExportedFile(filePath);
    
    if (phoneNumber) {
      // Filter by phone number (if phone number is in sender name or message)
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      return messages.filter(msg => {
        const normalizedSender = this.normalizePhoneNumber(msg.senderName);
        return normalizedSender.includes(normalizedPhone) || 
               msg.messageText.includes(phoneNumber);
      });
    }
    
    return messages;
  }
  
  /**
   * Normalize phone number for comparison
   * @param {string} phone - Phone number string
   * @returns {string} Normalized phone number (digits only)
   */
  normalizePhoneNumber(phone) {
    return phone.replace(/\D/g, '');
  }
}

module.exports = WhatsAppChatParser;
