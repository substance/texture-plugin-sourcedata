import { BasicEditorApi, documentHelpers, isArrayEqual } from 'substance'

export default class SmartFigureApi extends BasicEditorApi {
  insertPanelAfter (currentPanelId, file) {
    const doc = this.getDocument()
    const currentPanel = doc.get(currentPanelId)
    const figure = currentPanel.getParent()
    if (!figure) throw new Error('Figure does not exist')
    const pos = currentPanel.getPosition()
    const src = this.archive.addAsset(file)
    const insertPos = pos + 1
    const template = currentPanel.getTemplate()
    template.image.src = src
    template.image.mimeType = file.type
    this.editorSession.transaction(tx => {
      const newPanel = documentHelpers.createNodeFromJson(tx, template)
      documentHelpers.insertAt(tx, [figure.id, 'panels'], insertPos, newPanel.id)
      this._selectItem(tx, newPanel)
    })
  }

  replacePanelImage (panelId, file) {
    const doc = this.getDocument()
    const panel = doc.get(panelId)
    const image = panel.resolve('image')
    const articleSession = this.editorSession
    const newPath = this.archive.replaceAsset(image.src, file)
    articleSession.transaction(tx => {
      tx.set([image.id, 'src'], newPath)
    })
  }

  insertFile (fileName, file) {
    return this.insertFileAfter(fileName, file)
  }

  insertFileAfter (fileName, file, currentFileId) {
    const doc = this.getDocument()
    const root = doc.root
    let insertPos = root.files.length
    if (currentFileId) {
      const currentFileNode = doc.get(currentFileId)
      insertPos = currentFileNode.getPosition() + 1
    }
    const fileData = {
      name: fileName,
      type: file.type
    }
    const src = this.archive.addAsset(fileData, file)
    this.editorSession.transaction(tx => {
      const newFileNode = documentHelpers.createNodeFromJson(tx, {
        type: 'file',
        src,
        legend: [{ type: 'paragraph' }]
      })
      documentHelpers.insertAt(tx, [root.id, 'files'], insertPos, newFileNode.id)
      this._selectItem(tx, newFileNode)
    })
  }

  addKeywordGroup (panelId, keywordGroupData) {
    return this.insertKeywordGroupAfter(panelId, keywordGroupData)
  }

  updateKeywordGroup (keywordGroupId, data) {
    this.editorSession.transaction(tx => {
      const keywordGroup = tx.get(keywordGroupId)
      const oldKeywords = keywordGroup.resolve('keywords')
      const newKeywords = data.keywords
      const L = oldKeywords.length
      const M = newKeywords.length
      let idx = 0
      let idx1 = 0
      let idx2 = 0
      // assuming, that new keywords are given in the same order as the old ones
      // only with some items added, removed or updated
      while (idx1 < L || idx2 < M) {
        const kwd1 = oldKeywords[idx1]
        const kwd2 = newKeywords[idx2]
        if (idx1 >= L) {
          // append remaining new keywords
          const kwd = tx.create(kwd2)
          documentHelpers.append(tx, [keywordGroup.id, 'keywords'], kwd.id)
          idx++
          idx2++
        } else if (idx2 >= M) {
          // remove remaining old keywords
          documentHelpers.removeAt(tx, [keywordGroup.id, 'keywords'], idx)
          documentHelpers.deepDeleteNode(tx, kwd1.id)
          idx1++
        } else {
          // update an existing keyword if needed
          if (kwd1.id === kwd2.id) {
            if (kwd1.content !== kwd2.content) {
              kwd1.set('content', kwd2.content)
            }
            idx++
            idx1++
            idx2++
          } else {
            const kwd = tx.create(kwd2)
            documentHelpers.insertAt(tx, [keywordGroup.id, 'keywords'], idx, kwd.id)
            idx++
            idx2++
          }
        }
      }
    })
  }

  insertKeywordGroupAfter (panelId, keywordGroupData, currentKeywordGroupId) {
    const doc = this.getDocument()
    const panel = doc.get(panelId)
    let insertPos = panel.keywords.length
    if (currentKeywordGroupId) {
      const currentKeywordGroup = doc.get(currentKeywordGroupId)
      insertPos = currentKeywordGroup.getPosition() + 1
    }
    this.editorSession.transaction(tx => {
      const newKwdGroup = documentHelpers.createNodeFromJson(tx, keywordGroupData)
      documentHelpers.insertAt(tx, [panel.id, 'keywords'], insertPos, newKwdGroup.id)
      this._selectItem(tx, newKwdGroup)
    })
  }

  addResource (url) {
    return this.insertResourceAfter(url)
  }

  insertResourceAfter (url, currentFileId) {
    const doc = this.getDocument()
    const root = doc.root
    let insertPos = root.files.length
    if (currentFileId) {
      const currentFileNode = doc.get(currentFileId)
      insertPos = currentFileNode.getPosition() + 1
    }
    this.editorSession.transaction(tx => {
      const newFileNode = documentHelpers.createNodeFromJson(tx, {
        type: 'file',
        url,
        remote: true,
        legend: [{ type: 'paragraph' }]
      })
      documentHelpers.insertAt(tx, [root.id, 'files'], insertPos, newFileNode.id)
      this._selectItem(tx, newFileNode)
    })
  }

  updateAttachedFiles (panelId, attachedFileIds) {
    // TODO: for sake of convenience, it would be nice to allow upload new files from within the AttachFileModal
    // In this case we would need the blobs as an extra argument and store in the DAR
    const ids = Array.from(attachedFileIds)
    const doc = this.getDocument()
    const panel = doc.get(panelId)
    if (!isArrayEqual(panel.files, ids)) {
      // TODO: let this change be more incremental, i.e. adding, removing and later maybe changing order
      this.editorSession.transaction(tx => {
        doc.set([panel.id, 'files'], ids)
      })
    }
  }
}
