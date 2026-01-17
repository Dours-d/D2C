/**
 * WhatsApp Query Service
 * Queries messages from exported JSON files or parsed data
 */

const fs = require('fs');
const path = require('path');

class WhatsAppQueryService {
  /**
   * Load JSON export file
   * @param {string} jsonPath - Path to JSON file
   * @returns {Promise<Object>} Parsed JSON data
   */
  async loadJson(jsonPath) {
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found: ${jsonPath}`);
    }
    
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content);
  }
  
  /**
   * Query messages from exported JSON
   * @param {string} jsonPath - Path to exported JSON file
   * @param {Object} query - Query options
   * @returns {Promise<Array>} Filtered messages
   */
  async query(jsonPath, query = {}) {
    const data = await this.loadJson(jsonPath);
    
    // Extract all messages from JSON structure
    // WhatsApp exporter JSON format varies, try different structures
    let messages = [];
    
    if (Array.isArray(data)) {
      messages = data;
    } else if (data.chats && Array.isArray(data.chats)) {
      // Format: { chats: [...] }
      messages = data.chats.flatMap(chat => 
        (chat.messages || []).map(msg => ({
          ...msg,
          chatName: chat.name,
          chatPhone: chat.phone
        }))
      );
    } else if (data.messages && Array.isArray(data.messages)) {
      // Format: { messages: [...] }
      messages = data.messages;
    } else {
      // Try to find messages in any property
      for (const key in data) {
        if (Array.isArray(data[key])) {
          messages = data[key];
          break;
        }
      }
    }
    
    // Apply filters
    return this.filterMessages(messages, query);
  }
  
  /**
   * Filter messages based on query criteria
   * @param {Array} messages - Array of messages
   * @param {Object} query - Query options
   * @returns {Array} Filtered messages
   */
  filterMessages(messages, query = {}) {
    let filtered = [...messages];
    
    // Filter by phone number
    if (query.phoneNumber) {
      const normalizedPhone = this.normalizePhoneNumber(query.phoneNumber);
      filtered = filtered.filter(msg => {
        const senderPhone = this.normalizePhoneNumber(msg.from || msg.sender || msg.senderName || '');
        return senderPhone.includes(normalizedPhone);
      });
    }
    
    // Filter by date range
    if (query.startDate) {
      const startDate = new Date(query.startDate);
      filtered = filtered.filter(msg => {
        const msgDate = this.getMessageDate(msg);
        return msgDate >= startDate;
      });
    }
    
    if (query.endDate) {
      const endDate = new Date(query.endDate);
      filtered = filtered.filter(msg => {
        const msgDate = this.getMessageDate(msg);
        return msgDate <= endDate;
      });
    }
    
    // Filter by text search
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      filtered = filtered.filter(msg => {
        const text = (msg.messageText || msg.text || msg.body || '').toLowerCase();
        return text.includes(searchLower);
      });
    }
    
    // Filter by sender name
    if (query.senderName) {
      const senderLower = query.senderName.toLowerCase();
      filtered = filtered.filter(msg => {
        const sender = (msg.senderName || msg.sender || msg.from || '').toLowerCase();
        return sender.includes(senderLower);
      });
    }
    
    // Limit results
    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }
    
    // Sort
    if (query.sortBy) {
      const sortOrder = query.sortOrder || 'asc';
      filtered.sort((a, b) => {
        const dateA = this.getMessageDate(a);
        const dateB = this.getMessageDate(b);
        
        if (query.sortBy === 'date') {
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
        
        return 0;
      });
    }
    
    return filtered;
  }
  
  /**
   * Extract date from message object
   * @param {Object} msg - Message object
   * @returns {Date} Message date
   */
  getMessageDate(msg) {
    if (msg.timestamp) {
      // Unix timestamp (seconds)
      return new Date(msg.timestamp * 1000);
    }
    
    if (msg.date || msg.dateTime || msg.timestamp_ms) {
      // ISO date string or milliseconds timestamp
      return new Date(msg.date || msg.dateTime || msg.timestamp_ms);
    }
    
    // Try to parse from various date fields
    const dateFields = ['createdAt', 'sentAt', 'time'];
    for (const field of dateFields) {
      if (msg[field]) {
        return new Date(msg[field]);
      }
    }
    
    // Default to now if no date found
    return new Date();
  }
  
  /**
   * Normalize phone number for comparison
   * @param {string} phone - Phone number string
   * @returns {string} Normalized phone number (digits only)
   */
  normalizePhoneNumber(phone) {
    return phone.replace(/\D/g, '');
  }
  
  /**
   * Search for wallet addresses in messages
   * @param {Array} messages - Array of messages
   * @returns {Array} Messages with wallet addresses
   */
  findWalletAddresses(messages) {
    const tronAddressPattern = /T[A-Za-z1-9]{33}/g;
    const ethAddressPattern = /0x[a-fA-F0-9]{40}/g;
    
    return messages
      .map(msg => {
        const text = msg.messageText || msg.text || msg.body || '';
        const tronMatches = text.match(tronAddressPattern);
        const ethMatches = text.match(ethAddressPattern);
        
        if (tronMatches || ethMatches) {
          return {
            ...msg,
            walletAddresses: {
              tron: tronMatches || [],
              ethereum: ethMatches || []
            }
          };
        }
        
        return null;
      })
      .filter(msg => msg !== null);
  }
  
  /**
   * Search for donation amounts in messages
   * @param {Array} messages - Array of messages
   * @returns {Array} Messages with donation amounts
   */
  findDonationAmounts(messages) {
    const amountPatterns = [
      /(\d+\.?\d*)\s*(EUR|USD|USDT|€|\$)/i,
      /(€|\$)(\d+\.?\d*)/i,
      /(\d+\.?\d*)\s*(euro|dollar|usdt)/i
    ];
    
    return messages
      .map(msg => {
        const text = msg.messageText || msg.text || msg.body || '';
        
        for (const pattern of amountPatterns) {
          const match = text.match(pattern);
          if (match) {
            const amount = parseFloat(match[1] || match[2]);
            let currency = (match[2] || match[1]).toUpperCase();
            
            if (currency === '€') currency = 'EUR';
            if (currency === '$') currency = 'USD';
            
            return {
              ...msg,
              donationAmount: amount,
              donationCurrency: currency
            };
          }
        }
        
        return null;
      })
      .filter(msg => msg !== null);
  }
  
  /**
   * Extract donations from messages (wallet address + amount)
   * @param {Array} messages - Array of messages
   * @returns {Array} Extracted donation data
   */
  extractDonations(messages) {
    const donations = [];
    
    for (const msg of messages) {
      const text = msg.messageText || msg.text || msg.body || '';
      
      // Extract wallet address
      const walletMatch = text.match(/T[A-Za-z1-9]{33}/);
      if (!walletMatch) continue;
      
      // Extract amount
      const amountPatterns = [
        /(\d+\.?\d*)\s*(EUR|USD|USDT|€|\$)/i,
        /(€|\$)(\d+\.?\d*)/i,
        /(\d+\.?\d*)\s*(euro|dollar|usdt)/i
      ];
      
      let amount = null;
      let currency = null;
      
      for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
          amount = parseFloat(match[1] || match[2]);
          currency = (match[2] || match[1]).toUpperCase();
          
          if (currency === '€') currency = 'EUR';
          if (currency === '$') currency = 'USD';
          
          break;
        }
      }
      
      if (amount && walletMatch) {
        donations.push({
          messageId: msg.id || msg.messageId,
          senderName: msg.senderName || msg.sender || msg.from,
          senderPhone: msg.from || msg.phone,
          walletAddress: walletMatch[0],
          amount: amount,
          currency: currency,
          messageText: text,
          timestamp: this.getMessageDate(msg),
          chatName: msg.chatName,
          chatPhone: msg.chatPhone
        });
      }
    }
    
    return donations;
  }
}

module.exports = WhatsAppQueryService;
