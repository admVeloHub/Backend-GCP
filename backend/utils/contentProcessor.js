// VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
/**
 * Processador de conteúdo para substituir URLs blob temporárias por URLs do GCS
 */

const GCS_BUCKET_NAME_IMAGES = process.env.GCS_BUCKET_NAME2; // Bucket de imagens

/**
 * Processar conteúdo substituindo URLs blob temporárias por URLs do GCS
 * @param {string} conteudo - Conteúdo HTML/Markdown que pode conter URLs blob temporárias
 * @param {Array<string>} imagePaths - Array de caminhos relativos das imagens no GCS (ex: ["img_velonews/timestamp-file.png"])
 * @returns {string} Conteúdo processado com URLs do GCS
 */
function processContentImages(conteudo, imagePaths = []) {
  if (!conteudo || typeof conteudo !== 'string') {
    return conteudo;
  }

  if (!imagePaths || imagePaths.length === 0) {
    console.log('ℹ️ [processContentImages] Nenhum caminho de imagem fornecido, retornando conteúdo original');
    return conteudo;
  }

  if (!GCS_BUCKET_NAME_IMAGES) {
    console.warn('⚠️ [processContentImages] GCS_BUCKET_NAME_IMAGES não configurado, retornando conteúdo original');
    return conteudo;
  }

  let processedContent = conteudo;
  let processedCount = 0;

  // Construir URL base do GCS
  const gcsBaseUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME_IMAGES}`;

  // Processar cada caminho de imagem
  imagePaths.forEach((imagePath, index) => {
    const gcsUrl = `${gcsBaseUrl}/${imagePath}`;
    
    // Procurar URLs blob no conteúdo que correspondem a imagens temporárias
    // Pode estar em formato HTML: <img src="blob:..." alt="temp:uuid" ... />
    // Ou em formato markdown: ![temp:uuid](blob:...)
    
    // Regex para encontrar tags <img> com src blob e alt temp (ordem 1: src antes de alt)
    const htmlBlobRegex1 = /<img([^>]*src=["'])(blob:[^"']+)(["'][^>]*alt=["']temp:[^"']+["'][^>]*)>/gi;
    
    // Regex para encontrar tags <img> com src blob e alt temp (ordem 2: alt antes de src)
    const htmlBlobRegex2 = /<img([^>]*alt=["']temp:[^"']+["'][^>]*src=["'])(blob:[^"']+)(["'][^>]*)>/gi;
    
    // Regex para markdown: ![temp:uuid](blob:url)
    const markdownBlobRegex = /!\[temp:[^\]]+\]\(blob:[^)]+\)/g;
    
    // Substituir matches HTML (ordem 1: src antes de alt)
    processedContent = processedContent.replace(htmlBlobRegex1, (match, beforeSrc, blobUrl, afterSrc) => {
      // Substituir blob URL por GCS URL
      const replacement = match.replace(blobUrl, gcsUrl);
      processedCount++;
      console.log(`✅ [processContentImages] Substituído HTML (ordem 1): ${blobUrl.substring(0, 50)}... → ${gcsUrl}`);
      return replacement;
    });
    
    // Substituir matches HTML (ordem 2: alt antes de src)
    processedContent = processedContent.replace(htmlBlobRegex2, (match, beforeAlt, blobUrl, afterBlob) => {
      // Substituir blob URL por GCS URL
      const replacement = match.replace(blobUrl, gcsUrl);
      processedCount++;
      console.log(`✅ [processContentImages] Substituído HTML (ordem 2): ${blobUrl.substring(0, 50)}... → ${gcsUrl}`);
      return replacement;
    });
    
    // Substituir matches markdown
    processedContent = processedContent.replace(markdownBlobRegex, (match) => {
      // Extrair alt text se houver
      const altMatch = match.match(/!\[([^\]]+)\]/);
      const altText = altMatch ? altMatch[1].replace(/^temp:/, '') : 'Imagem';
      
      // Criar novo markdown com URL do GCS
      const replacement = `![${altText}](${gcsUrl})`;
      processedCount++;
      console.log(`✅ [processContentImages] Substituído Markdown: ${match.substring(0, 50)}... → ${replacement}`);
      return replacement;
    });
  });

  if (processedCount > 0) {
    console.log(`✅ [processContentImages] Processadas ${processedCount} substituição(ões) de URL`);
  } else {
    console.log('ℹ️ [processContentImages] Nenhuma URL blob encontrada para substituir');
  }

  return processedContent;
}

module.exports = {
  processContentImages
};

