# MAP — где что лежит (генерируется tools/mkmap.py, не править руками)



Формат: `L<номер> имя` — объявление верхнего уровня; `- L<n> название` — раздел.

Перегенерировать после правок структуры: `python3 tools/mkmap.py`.



## app.js
  L14 CATEGORIES
  L15 PROJECTS
  L16 SITE
  L17 PROFILE
  L20 UI
  L29 applySite
  L37 PAGE_ANCHOR
  L38 offPage
  L42 linkHref
  L43 applyLinks
  L55 loadSite
  L57 store
  L62 lang
  L63 filter
  L66 esc
  L67 PAGE
  L70 EDITOR
  L76 agent
  L79 plural
  L85 num
  L89 COVER_FITS
  L90 coverStyle
  L100 coverHTML
  L115 badgeHTML
  L123 pageURL
  L125 linksHTML
  L137 hrefAttr
  L138 setupCardLinks
  L147 tagsHTML
  L151 CARD_PARTS
  L152 cardParts
  L168 cardHTML
  L180 statsHTML
  L189 areasHTML
  L197 softHTML
  L199 expHTML
  L214 L
  L215 imgSrc
  L216 getIn
  L220 fld
  L227 empty
  L228 imgHTML
  L230 loopHTML
  L234 codeHTML
  L235 ext
  L237 hasHead
  L238 each
  L239 btns
  L242 videoHTML
  L252 BLOCK_HTML
- L293 the Virtual Gifts case (styles: gifts.css, gc-*; the three interactive ones are run by gifts.js)
  L384 giftsData
  L385 giftChat
  L389 giftPhone
  L396 PLATFORM_ICONS
  L402 statNum
  L408 SAFARI
  L409 chainBody
  L425 OWN_HEAD
  L427 headHTML
  L433 nextHTML
  L440 blockHTML
  L454 blocksHTML
  L456 vio
  L459 watchVideos
  L465 arrangeBlocks
  L481 renderHome
  L516 renderProjects
  L528 renderProject
  L566 cvAvailable
  L567 renderContact
  L585 STYLE_KEYS
  L590 gapKey
  L591 gapScale
  L592 nextShown
  L597 setGap
  L610 gapStyles
  L611 applyGaps
  L621 gapResize
  L624 styleBlocks
  L645 io
  L650 firstRender
  L651 watchReveal
  L659 render
  L702 rail
  L703 setupRail
  L730 railScroll
  L764 xWait
  L765 runExport
  L809 xNextGift
  L823 xView
  L829 setupExports
  L844 agentText
  L846 linkMd
  L847 renderAgent
  L876 setProjects
  L884 EDITABLE
  L890 decorateForEditor
  L911 bootEditor
  L1057 setupStackTips
  L1091 heroGiftList
  L1092 pickHeroGift
  L1099 pickBoxGift
  L1116 boxesOpened
  L1117 boxesY
  L1118 boxFromExport
  L1126 setupScrollBoxes
  L1135 scrollBoxes
  L1159 setupUnbox
- L1321 mini chat: the feedback-chat component (repo feedback-chat, loaded from its Pages)
  L1324 startChat
  L1355 setupToTop
  L1376 setupCoverZoom

## admin.js
  L9 REPO
  L10 BRANCH
  L11 DATA
  L12 SITE_FILE
  L13 SHOTS
  L14 MAX_W
  L15 OWNER
  L18 FIREBASE
  L25 FB
  L26 TOKEN_PATH
  L28 q
  L29 h
  L31 token
  L32 data
  L33 savedJSON
  L34 site
  L35 siteSaved
  L36 sel
  L37 pvLang
  L38 pending
  L39 replaced
  L43 gh
  L62 getFile
  L64 putFile
  L78 deleteFile
  L84 utf8ToB64
  L89 b64ToUtf8
  L93 fb
  L95 initFirebase
  L114 loginStatus
  L120 onUser
  L139 askToken
  L145 useToken
  L182 LOCAL
  L184 readJSON
  L190 load
  L208 normalize
  L219 clean
  L238 imagesOf
  L247 serialize
  L248 serializeSite
  L249 projectsDirty
  L250 siteDirty
  L251 isDirty
  L253 publish
  L296 PAGES
  L297 I18N_EL
  L300 hiddenCSS
  L308 bakeHTML
  L315 bakePages
  L334 setStatus
  L339 updateStatus
  L346 catName
  L348 renderList
  L400 coverType
  L402 renderEditor
  L490 FIT_OPTS
  L498 coverPos
  L500 coverFitHTML
  L530 coverInput
  L545 setPath
  L619 shrink
  L645 renderPreview
  L660 renderAll
  L666 BLOCKS
  L676 KEY_LABEL
  L689 LISTS
  L711 loc
  L712 head
  L713 hasHead
  L714 items
  L715 TYPES
  L793 tl
  L794 SUBS
  L835 seLang
  L836 seTarget
  L837 seBlock
  L838 seAddAt
  L839 seUndo
  L840 seFold
  L841 frameLoaded
  L843 getPath
  L844 fromField
  L847 toField
  L848 srcOf
  L850 seProject
  L851 curBlocks
  L852 findBlock
  L853 panelObj
  L854 newId
  L855 blockLabel
  L946 hideText
  L956 hideTab
  L965 refreshTimer
  L966 refreshFrame
  L972 scrollFrameTo
  L982 externalPage
  L983 loadFrame
  L998 selectBlock
  L1004 blockAction
  L1029 addBlock
  L1038 renderTargets
  L1046 renderSeBlocks
  L1102 openPage
  L1108 textFields
  L1127 LINK_DEFAULT
  L1131 ANCHORS
  L1134 linkField
  L1140 anchorList
  L1143 field
  L1151 repeater
  L1171 giftsBase
  L1173 giftsCache
  L1174 giftsFor
  L1185 giftPicker
  L1203 giftPick
  L1217 arrBtns
  L1222 bField
  L1273 STYLE_OPTS
  L1282 styleClip
  L1283 styleSection
  L1316 CARD_LABELS
  L1317 cardOrder
  L1321 cardSection
  L1331 setCard
  L1341 setStyle
  L1349 renderSePanel
  L1512 readRaw
  L1518 upload
  L1646 history
  L1647 restoredFrom
  L1649 loadHistory
  L1667 ADMIN_MSG
  L1668 renderHistory
  L1683 restoreVersion
  L1720 setMode
  L1733 renderSite
- типы блоков (TYPES): hero, stats, areas, showcase, stack, exp, contact, general, text, facts, stats, cards, flow, code, strip, cast, pair, lineups, covers, vcovers, phones, results, image, gallery, video, quote, links, novel, points, specs, split, rail, chain, export, unbox, list2, lanes, gifts-showcase, gifts-process, gifts-catalog, next

## guest.js
  L7 startGuest
  L158 openCvPreview

## novel.js
- L57 sound effects: synthesized on the fly, nothing to download. The context starts on the first click
- L407 the floating window: a teaser square in the bottom-right corner → opens over the page → folds back

## gifts.js

## style.css
- L3 header
- L64 hero
- L131 section heads
- L137 filters
- L147 grid & cards
- L222 featured case
- L242 contact (CTA with light beams)
- L258 footer
- L527 guest cursor: Figma-style collaborator drops a CV file (guest.js)
- L583 CV preview popup (guest.js → openCvPreview)
- L621 stack chip tooltip (app.js: profile.stackInfo)
- L707 back to top (setupToTop in app.js): bottom middle on every page, half-transparent; shows after one screen of scroll
- L732 mini chat (feedback-chat component, startChat in app.js): Lighthouse colours; stands on the novel teaser (novel.js: as wide as the chat button, 112px on a phone) while it's shown
- L736 a cover zoomed in (setupCoverZoom in app.js): over the darkened, blurred page, like the gift overlay

## case.css
- L5 hero
- L57 facts
- L77 shared bits
- L86 task cards
- L94 pipeline
- L134 one story in a row
- L171 casts
- L182 library
- L191 promo
- L229 result

## design-system.css

## gifts.css
- L14 showcase: laptop + phone mockups
- L111 cards: task & delivery
- L126 style
- L146 process: one gift, five steps
- L200 pipeline
- L264 export animation (runExport in app.js)
- L315 chain: a story as an equation (frame + prompt = video)
- L349 interactive catalog
- L394 delivery callout
- L438 results
- L451 overlay: the page dims and blurs a little, the gift plays over it; a click anywhere closes

## novel.css
- L15 the window: laid out open in the middle (novel.js place()), folded = moved and scaled into the corner
- L79 the phone
- L168 the library

## index.html
- id: baked-hidden@27, cvTop@36, lang@38, home@42, numbers@61, stats@61, about@63, areas@69, soft@72, work@76, showcase@81, tools@85, stackTitle@86, stack@87, experience@90, exp@95, contact@98, year@111

## project.html
- id: baked-hidden@28, cvTop@37, lang@39, projHead@43, projBlocks@44, projContact@46, year@59

## projects.html
- id: baked-hidden@25, cvTop@34, lang@36, filters@48, grid@49, year@65

## contact.html
- id: baked-hidden@25, cvTop@34, lang@36, cvLinks@52, channels@56, areas@62, year@68

## admin.html
- id: logout@199, login@208, googleBtn@211, loginStatus@212, tokenSetup@215, tokenWhy@216, token@222, tokenBtn@223, app@228, modes@229, projectsMode@235, items@238, addBtn@239, edit@241, siteMode@246, seTarget@249, seOpen@250, seBlocks@252, seFrameWrap@266, seFrame@266, sePanel@268, historyMode@273, hist@276, bar@281, status@282, reloadBtn@284, saveBtn@285
