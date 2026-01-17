/**
 * WhatsApp Chat Exporter Query Module
 * Integrates with Python whatsapp-chat-exporter to query and parse WhatsApp chats
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WhatsAppChatParser = require('./src/ChatParser');
const WhatsAppQueryService = require('./src/QueryService');

module.exports = {
  WhatsAppChatParser,
  WhatsAppQueryService,
  
  /**
   * Export WhatsApp chats using Python exporter
   * @param {Object} options - Export options
   * @returns {Promise<string>} Output directory path
   */
  async exportChats(options = {}) {
    const {
      sourcePath,        // Path to msgstore.db or exported chat file
      outputDir = './whatsapp-export',
      format = 'json',   // 'json' or 'txt'
      platform = 'android', // 'android' or 'ios' or 'exported'
      keyFile = null,    // Decryption key file (for encrypted backups)
      mediaDir = null    // WhatsApp media directory
    } = options;

    return new Promise((resolve, reject) => {
      // Build wtsexporter command
      const args = [];
      
      if (platform === 'android') {
        args.push('-a');
      } else if (platform === 'ios') {
        args.push('-i');
      } else if (platform === 'exported') {
        args.push('-e', sourcePath);
      }
      
      if (sourcePath && platform !== 'exported') {
        args.push('-d', sourcePath);
      }
      
      if (keyFile) {
        args.push('-k', keyFile);
      }
      
      if (mediaDir) {
        args.push('-m', mediaDir);
      }
      
      if (format === 'json') {
        args.push('-j', path.join(outputDir, 'result.json'));
      } else {
        args.push('--txt', outputDir);
      }
      
      args.push('-o', outputDir);
      
      // Find wtsexporter in PATH or use Python module
      const wtsexporter = process.platform === 'win32' ? 'wtsexporter.exe' : 'wtsexporter';
      
      const process = spawn(wtsexporter, args, {
        shell: true,
        cwd: process.cwd()
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(outputDir);
        } else {
          reject(new Error(`Export failed: ${stderr || stdout}`));
        }
      });
      
      process.on('error', (error) => {
        // If wtsexporter not found, try python -m
        if (error.code === 'ENOENT') {
          const pythonProcess = spawn('python', ['-m', 'Whatsapp_Chat_Exporter', ...args], {
            shell: true,
            cwd: process.cwd()
          });
          
          pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              resolve(outputDir);
            } else {
              reject(new Error(`Python export failed: ${stderr || stdout}`));
            }
          });
          
          pythonProcess.on('error', (err) => {
            reject(new Error(`Failed to run exporter: ${err.message}. Make sure whatsapp-chat-exporter is installed: pip install whatsapp-chat-exporter`));
          });
        } else {
          reject(error);
        }
      });
    });
  },
  
  /**
   * Parse exported chat file (.txt format)
   * @param {string} filePath - Path to exported chat file
   * @returns {Promise<Array>} Parsed messages
   */
  async parseExportedFile(filePath) {
    const parser = new WhatsAppChatParser();
    return parser.parseExportedFile(filePath);
  },
  
  /**
   * Query messages from exported JSON
   * @param {string} jsonPath - Path to exported JSON file
   * @param {Object} query - Query options
   * @returns {Promise<Array>} Filtered messages
   */
  async queryMessages(jsonPath, query = {}) {
    const queryService = new WhatsAppQueryService();
    return queryService.query(jsonPath, query);
  }
};
