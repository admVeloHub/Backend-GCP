/**
 * VeloHub SKYNET - MongoDB Auth Adapter para Baileys
 * VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
 * 
 * Adapter para armazenar credenciais do Baileys no MongoDB
 * Database: hub_escalacoes
 * Collection: auth
 */

const { MongoClient } = require('mongodb');
const { getMongoUri } = require('../../config/mongodb');
const fs = require('fs');
const path = require('path');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

class MongoAuthAdapter {
  constructor() {
    this.dbName = 'hub_escalacoes';
    this.collectionName = 'auth';
    this.docId = 'whatsapp_baileys_auth';
    this.tempDir = path.join(__dirname, '../../auth_temp');
    this.client = null;
  }

  /**
   * Obter cliente MongoDB (singleton)
   */
  async _getClient() {
    if (!this.client) {
      try {
        const uri = getMongoUri();
        this.client = new MongoClient(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        await this.client.connect();
        console.log('[WHATSAPP] Conectado ao MongoDB para auth');
      } catch (error) {
        console.error('[WHATSAPP] Erro ao conectar MongoDB:', error.message);
        throw error;
      }
    }
    return this.client;
  }

  /**
   * Obter collection do MongoDB
   */
  async _getCollection() {
    const client = await this._getClient();
    const db = client.db(this.dbName);
    return db.collection(this.collectionName);
  }

  /**
   * Garantir que diretório temporário existe
   */
  _ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      console.log('[WHATSAPP] Diretório temporário criado:', this.tempDir);
    }
  }

  /**
   * Ler arquivos do MongoDB
   */
  async _readFilesFromMongo() {
    try {
      const collection = await this._getCollection();
      const doc = await collection.findOne({ _id: this.docId });
      
      if (!doc || !doc.files) {
        return null;
      }
      
      return doc.files;
    } catch (error) {
      console.error('[WHATSAPP] Erro ao ler arquivos do MongoDB:', error.message);
      // Se erro, retornar null para gerar novo QR
      return null;
    }
  }

  /**
   * Escrever arquivos no MongoDB
   */
  async _writeFilesToMongo(files) {
    try {
      const collection = await this._getCollection();
      
      await collection.updateOne(
        { _id: this.docId },
        {
          $set: {
            files: files,
            updatedAt: new Date(),
            version: 1
          }
        },
        { upsert: true }
      );
      
      console.log('[WHATSAPP] Credenciais salvas no MongoDB (hub_escalacoes.auth)');
    } catch (error) {
      console.error('[WHATSAPP] Erro ao salvar arquivos no MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Carregar estado de autenticação do MongoDB
   * Retorna { state, saveCreds } compatível com useMultiFileAuthState
   */
  async loadAuthState() {
    try {
      this._ensureTempDir();
      
      // Ler arquivos do MongoDB
      const files = await this._readFilesFromMongo();
      
      if (!files) {
        // Sem credenciais - Baileys vai gerar QR code
        console.log('[WHATSAPP] Nenhuma credencial encontrada no MongoDB - QR code será gerado');
        const { state, saveCreds } = await useMultiFileAuthState(this.tempDir);
        
        // Wrapper para salvar no MongoDB quando credenciais forem atualizadas
        const wrappedSaveCreds = async () => {
          await saveCreds(); // Salva nos arquivos temporários primeiro
          await this.saveAuthState(); // Depois salva no MongoDB
        };
        
        return { state, saveCreds: wrappedSaveCreds };
      }
      
      // Recriar arquivos do MongoDB no diretório temporário
      console.log('[WHATSAPP] Carregando credenciais do MongoDB...');
      for (const [filename, content] of Object.entries(files)) {
        const filePath = path.join(this.tempDir, filename);
        const fileContent = typeof content === 'string' 
          ? content 
          : JSON.stringify(content, null, 2);
        fs.writeFileSync(filePath, fileContent, 'utf8');
      }
      
      console.log(`[WHATSAPP] ${Object.keys(files).length} arquivos restaurados do MongoDB`);
      
      // Usar useMultiFileAuthState com diretório temporário
      const { state, saveCreds } = await useMultiFileAuthState(this.tempDir);
      
      // Wrapper para salvar no MongoDB quando credenciais forem atualizadas
      const wrappedSaveCreds = async () => {
        await saveCreds(); // Salva nos arquivos temporários primeiro
        await this.saveAuthState(); // Depois salva no MongoDB
      };
      
      return { state, saveCreds: wrappedSaveCreds };
      
    } catch (error) {
      console.error('[WHATSAPP] Erro ao carregar estado do MongoDB:', error.message);
      // Em caso de erro, tentar usar diretório temporário vazio (vai gerar QR)
      this._ensureTempDir();
      const { state, saveCreds } = await useMultiFileAuthState(this.tempDir);
      
      const wrappedSaveCreds = async () => {
        await saveCreds();
        try {
          await this.saveAuthState();
        } catch (err) {
          console.error('[WHATSAPP] Erro ao salvar após fallback:', err.message);
        }
      };
      
      return { state, saveCreds: wrappedSaveCreds };
    }
  }

  /**
   * Salvar estado de autenticação no MongoDB
   */
  async saveAuthState() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        console.log('[WHATSAPP] Diretório temporário não existe - nada para salvar');
        return;
      }
      
      // Ler todos os arquivos do diretório temporário
      const files = {};
      const fileList = fs.readdirSync(this.tempDir);
      
      for (const filename of fileList) {
        const filePath = path.join(this.tempDir, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Tentar parsear JSON, se falhar manter como string
        try {
          files[filename] = JSON.parse(content);
        } catch {
          files[filename] = content;
        }
      }
      
      if (Object.keys(files).length === 0) {
        console.log('[WHATSAPP] Nenhum arquivo para salvar');
        return;
      }
      
      // Salvar no MongoDB
      await this._writeFilesToMongo(files);
      
    } catch (error) {
      console.error('[WHATSAPP] Erro ao salvar estado no MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Limpar estado de autenticação (logout)
   */
  async clearAuthState() {
    try {
      // Remover documento do MongoDB
      const collection = await this._getCollection();
      await collection.deleteOne({ _id: this.docId });
      console.log('[WHATSAPP] Credenciais removidas do MongoDB');
      
      // Limpar diretório temporário
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log('[WHATSAPP] Diretório temporário limpo');
      }
      
    } catch (error) {
      console.error('[WHATSAPP] Erro ao limpar estado:', error.message);
      // Tentar limpar diretório mesmo se MongoDB falhar
      if (fs.existsSync(this.tempDir)) {
        try {
          fs.rmSync(this.tempDir, { recursive: true, force: true });
        } catch (err) {
          console.error('[WHATSAPP] Erro ao limpar diretório temporário:', err.message);
        }
      }
      throw error;
    }
  }

  /**
   * Fechar conexão MongoDB
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      console.log('[WHATSAPP] Conexão MongoDB fechada');
    }
  }
}

module.exports = MongoAuthAdapter;

