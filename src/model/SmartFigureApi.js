import {
  BasicEditorApi, AuthorApi, AffiliationApi,
  isString, documentHelpers
} from 'substance'

export default class SmartFigureApi extends BasicEditorApi {
  constructor (...args) {
    super(...args)

    this.extendWith(new AuthorApi())
    this.extendWith(new AffiliationApi())
  }

  insertPanel (file, currentPanelId) {
    const doc = this.getDocument()
    const root = doc.root
    let insertPos = root.panels.length
    let template = {
      type: 'panel',
      image: { type: 'image' },
      legend: [{ type: 'paragraph' }]
    }
    if (currentPanelId) {
      const currentPanel = doc.get(currentPanelId)
      insertPos = currentPanel.getPosition() + 1
      template = currentPanel.getTemplate()
    }
    const assetId = this.archive.addAsset(file)
    template.image.src = assetId
    template.image.mimeType = file.type
    this.editorSession.transaction(tx => {
      const newPanel = documentHelpers.createNodeFromJson(tx, template)
      documentHelpers.insertAt(tx, [root.id, 'panels'], insertPos, newPanel.id)
      this._selectItem(tx, newPanel)
    })
  }

  replacePanelImage (panelId, file) {
    // Note: as assets are not owned by the document
    // there is no change happening within the document
    // Thus we have to trigger a fake update of image.src
    // so that the change is reflected visually
    const doc = this.getDocument()
    const panel = doc.get(panelId)
    const image = panel.resolve('image')
    // Note: internally image.src is the assetId, not filename
    const newAssetId = this.archive.addAsset(file)
    this.editorSession.transaction(tx => {
      tx.set([image.id, 'src'], newAssetId)
    })
    return newAssetId
  }

  addFile (fileName, file) {
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
    const assetId = this.archive.addAsset({
      name: fileName,
      type: file.type
    }, file)
    let newNodeId
    this.editorSession.transaction(tx => {
      const newFileNode = documentHelpers.createNodeFromJson(tx, {
        type: 'file',
        src: assetId,
        legend: [{ type: 'paragraph' }]
      })
      newNodeId = newFileNode.id
      documentHelpers.insertAt(tx, [root.id, 'files'], insertPos, newFileNode.id)
      this._selectItem(tx, newFileNode)
    })
    return doc.get(newNodeId)
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

  addResource (data) {
    return this.insertResourceAfter(data)
  }

  insertResourceAfter (data, currentFileId) {
    const doc = this.getDocument()
    const root = doc.root
    let insertPos = root.resources.length
    if (currentFileId) {
      const currentFileNode = doc.get(currentFileId)
      insertPos = currentFileNode.getPosition() + 1
    }
    const nodeData = Object.assign({ type: 'resource', legend: [{ type: 'paragraph' }] }, data)
    let newResourceNodeId
    this.editorSession.transaction(tx => {
      const node = documentHelpers.createNodeFromJson(tx, nodeData)
      newResourceNodeId = node.id
      documentHelpers.insertAt(tx, [root.id, 'resources'], insertPos, node.id)
      this._selectItem(tx, node)
    })
    return doc.get(newResourceNodeId)
  }

  attachFile (panelId, fileId) {
    this.editorSession.transaction(tx => {
      documentHelpers.append(tx, [panelId, 'files'], fileId)
      this._selectValue(tx, panelId, 'files', fileId)
    })
  }

  attachResource (panelId, resourceId) {
    this.editorSession.transaction(tx => {
      documentHelpers.append(tx, [panelId, 'resources'], resourceId)
      this._selectValue(tx, panelId, 'resources', resourceId)
    })
  }

  // TODO: I'd like to have a specific selection for 'many' type relationships (e.g. author affiliations, or figure panel files, etc.)
  // maybe this could be applied to 'children' type relationships, too (e.g. author, affiliation, etc.)
  selectValue (node, propertyName, valueId) {
    if (isString(node)) {
      node = this.getDocument().get(node)
    }
    this._selectValue(this.editorSession, node.id, propertyName, valueId)
  }

  _selectValue (tx, nodeId, propertyName, valueId) {
    tx.setSelection({
      type: 'custom',
      customType: 'value',
      nodeId: nodeId,
      data: {
        property: propertyName,
        valueId
      }
    })
  }
}
