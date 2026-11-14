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
  L27 STICKER_TOKEN_PATH
  L29 q
  L30 h
  L32 token
  L33 data
  L34 savedJSON
  L35 site
  L36 siteSaved
  L37 sel
  L38 pvLang
  L39 pending
  L40 replaced
  L44 gh
  L63 getFile
  L65 putFile
  L79 deleteFile
  L85 utf8ToB64
  L90 b64ToUtf8
  L94 fb
  L96 initFirebase
  L115 loginStatus
  L121 onUser
  L140 askToken
  L146 useToken
  L197 LOCAL
  L199 readJSON
  L205 load
  L223 normalize
  L234 clean
  L253 imagesOf
  L262 serialize
  L263 serializeSite
  L264 projectsDirty
  L265 siteDirty
  L266 isDirty
  L268 publish
  L311 PAGES
  L312 I18N_EL
  L315 hiddenCSS
  L323 bakeHTML
  L330 bakePages
  L349 setStatus
  L354 updateStatus
  L361 catName
  L363 renderList
  L415 coverType
  L417 renderEditor
  L505 FIT_OPTS
  L513 coverPos
  L515 coverFitHTML
  L545 coverInput
  L560 setPath
  L634 shrink
  L660 renderPreview
  L675 renderAll
  L681 BLOCKS
  L691 KEY_LABEL
  L704 LISTS
  L726 loc
  L727 head
  L728 hasHead
  L729 items
  L730 TYPES
  L808 tl
  L809 SUBS
  L850 seLang
  L851 seTarget
  L852 seBlock
  L853 seAddAt
  L854 seUndo
  L855 seFold
  L856 frameLoaded
  L858 getPath
  L859 fromField
  L862 toField
  L863 srcOf
  L865 seProject
  L866 curBlocks
  L867 findBlock
  L868 panelObj
  L869 newId
  L870 blockLabel
  L961 hideText
  L971 hideTab
  L980 refreshTimer
  L981 refreshFrame
  L987 scrollFrameTo
  L997 externalPage
  L998 loadFrame
  L1013 selectBlock
  L1019 blockAction
  L1044 addBlock
  L1053 renderTargets
  L1061 renderSeBlocks
  L1117 openPage
  L1123 textFields
  L1142 LINK_DEFAULT
  L1146 ANCHORS
  L1149 linkField
  L1155 anchorList
  L1158 field
  L1166 repeater
  L1186 giftsBase
  L1188 giftsCache
  L1189 giftsFor
  L1200 giftPicker
  L1218 giftPick
  L1232 arrBtns
  L1237 bField
  L1288 STYLE_OPTS
  L1297 styleClip
  L1298 styleSection
  L1331 CARD_LABELS
  L1332 cardOrder
  L1336 cardSection
  L1346 setCard
  L1356 setStyle
  L1364 renderSePanel
  L1527 readRaw
  L1533 upload
  L1661 history
  L1662 restoredFrom
  L1664 loadHistory
  L1682 ADMIN_MSG
  L1683 renderHistory
  L1698 restoreVersion
  L1735 setMode
  L1748 renderSite
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
- id: logout@199, login@208, googleBtn@211, loginStatus@212, tokenSetup@215, tokenWhy@216, token@222, tokenBtn@223, app@228, stickerTokenSetup@230, stickerToken@233, stickerTokenBtn@234, stickerTokenStatus@234, modes@236, projectsMode@242, items@245, addBtn@246, edit@248, siteMode@253, seTarget@256, seOpen@257, seBlocks@259, seFrameWrap@273, seFrame@273, sePanel@275, historyMode@280, hist@283, bar@288, status@289, reloadBtn@291, saveBtn@292
