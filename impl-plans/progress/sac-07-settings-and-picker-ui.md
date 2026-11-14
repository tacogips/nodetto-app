# sac-07 progress

Intent SHA-256: fe8c03b23a790cd873b70f396bcf094dcf18938bd986188eb16996ac8c4fb28b  impl-plans/active/sac-07-settings-and-picker-ui.md

Implementation: settings command builders and section, source options and dialog, optional PageTabs menu callback. Wiring remains with sac-08.

Per-edit SHA-256 (before -> after; exit status):
- edit-01 packages/ui-solid/src/inspector/presentation-settings.ts: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> c44a63dd13cf3a5cd01ebf444fe2d82bf86e71c1a0ce109499020433b66aa721; exit 0
- edit-02 packages/ui-solid/src/copy-shapes-options.ts: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> b37538e335b062213b981ff4c6bf1d1ccffc43a9b8ae79891e33b74162138fcc; exit 0
- edit-03 packages/ui-solid/src/inspector/PresentationSection.tsx: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> 16603164858cc8401fe785d187db6f40f35851528455824a14e5617dedbb2a32; exit 0
- edit-04 packages/ui-solid/src/CopyShapesDialog.tsx: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> bbeb928fb1d6eebd530a0769196cf03a563c2d67e1b2bd033304a1f5f16bed80; exit 0
- edit-05 packages/ui-solid/src/CopyShapesDialog.css: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> 5e90032629de90ceabd141c3845c763db6101407f2c3cecc7956b76d5b82c616; exit 0
- edit-06 packages/ui-solid/src/PageTabs.tsx: 22eb6addba06b6f613bd3745fe2dd42ae2edac1f7e2009378844640330d5c98e -> 00cc78b1604b7b413443ee0243d7b32f583d1e0bf472e789edfd7c2a6de52a2f; exit 0
- edit-07 packages/ui-solid/src/copy-shapes-options.test.ts: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> 722ab74966be86b23f5099003419d94e0886e0380d4c33d3a0e83af8fb1a6791; exit 0
- edit-08 packages/ui-solid/src/inspector/presentation-settings.test.ts: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 -> 29d9ceb67a407e8f4a8a2a9839ca71d81fc5cbe3caf463ec5dde36e2f6cba593; exit 0
- edit-09 packages/ui-solid/src/inspector/PresentationSection.tsx: 16603164858cc8401fe785d187db6f40f35851528455824a14e5617dedbb2a32 -> dee2efb55a55256216a0e5192ec83c178a8d48ba451335ae1acb85e387aee62c; exit 0
- edit-10 packages/ui-solid/src/inspector/PresentationSection.tsx: dee2efb55a55256216a0e5192ec83c178a8d48ba451335ae1acb85e387aee62c -> be92472155cee2fde1d3f13e116c2acc4207c1d11f4d3008c3e69174fcd7c7f1; exit 0
- edit-11 packages/ui-solid/src/inspector/presentation-settings.ts: c44a63dd13cf3a5cd01ebf444fe2d82bf86e71c1a0ce109499020433b66aa721 -> b9d9e826e9e8c94c0ed4ac01c80e63331c7f3ce90a3af8d80d3ab1cc531099d8; exit 0
- edit-12 packages/ui-solid/src/inspector/presentation-settings.test.ts: 29d9ceb67a407e8f4a8a2a9839ca71d81fc5cbe3caf463ec5dde36e2f6cba593 -> 4161ce5e8e6eb8dcea32a8f5328e75767c0b414d6935e6d945f55d55065a7ffa; exit 0
- edit-13 packages/ui-solid/src/copy-shapes-options.ts: b37538e335b062213b981ff4c6bf1d1ccffc43a9b8ae79891e33b74162138fcc -> eba274a6f7421a30547c1fab6af7e69c881e144e7d2e9a7e82ec8545a91ab236; exit 0
- edit-14 packages/ui-solid/src/copy-shapes-options.test.ts: 722ab74966be86b23f5099003419d94e0886e0380d4c33d3a0e83af8fb1a6791 -> db93c107ba4e9a9dfcc85dea366808797e0d2e8cbc650970c42b28ab0ba8348f; exit 0
- edit-15 packages/ui-solid/src/CopyShapesDialog.tsx: bbeb928fb1d6eebd530a0769196cf03a563c2d67e1b2bd033304a1f5f16bed80 -> 66aaf47c1586a2a36175379a9f54a7ee3a1f34479051e1c5cdae8705b2d03494; exit 0
- edit-16 packages/ui-solid/src/CopyShapesDialog.css: 5e90032629de90ceabd141c3845c763db6101407f2c3cecc7956b76d5b82c616 -> 9747f0d0ae17edcafe92d0f7c9edf1344a1dd09a905306d73e771b6e86d03397; exit 0
- edit-17 packages/ui-solid/src/PageTabs.tsx: 00cc78b1604b7b413443ee0243d7b32f583d1e0bf472e789edfd7c2a6de52a2f -> dfec145e977ff0150e93edcb9b3ec2249dfdae4a941a403733a8bb2a96bc46c3; exit 0
- edit-18 packages/ui-solid/src/inspector/presentation-settings.test.ts: 4161ce5e8e6eb8dcea32a8f5328e75767c0b414d6935e6d945f55d55065a7ffa -> 529de740e7f101731aa45dfde30a26a72b0868ec2d45f7e791e4d797834fcea1; exit 0
- edit-19 packages/ui-solid/src/inspector/PresentationSection.tsx: be92472155cee2fde1d3f13e116c2acc4207c1d11f4d3008c3e69174fcd7c7f1 -> 58835675e2234c2f853b8b0baa312c3de1bb79416fc11419a572dc6fb32ef9fb; exit 0
- edit-20 packages/ui-solid/src/CopyShapesDialog.tsx: 66aaf47c1586a2a36175379a9f54a7ee3a1f34479051e1c5cdae8705b2d03494 -> 8122ccaff7fed9baec178c173d844c6482f9b6ef44526ac3d2ea727ff8a98873; exit 0
- edit-21 packages/ui-solid/src/inspector/PresentationSection.tsx: 58835675e2234c2f853b8b0baa312c3de1bb79416fc11419a572dc6fb32ef9fb -> ebd5a851ac46fe778dff8596071f1c1d8f8349058db1233dbb15778fd3f860f7; exit 0
- edit-22 packages/ui-solid/src/inspector/presentation-settings.ts: b9d9e826e9e8c94c0ed4ac01c80e63331c7f3ce90a3af8d80d3ab1cc531099d8 -> b9d9e826e9e8c94c0ed4ac01c80e63331c7f3ce90a3af8d80d3ab1cc531099d8; exit 0
- edit-23 packages/ui-solid/src/inspector/presentation-settings.test.ts: 529de740e7f101731aa45dfde30a26a72b0868ec2d45f7e791e4d797834fcea1 -> 529de740e7f101731aa45dfde30a26a72b0868ec2d45f7e791e4d797834fcea1; exit 0
- edit-24 packages/ui-solid/src/copy-shapes-options.ts: eba274a6f7421a30547c1fab6af7e69c881e144e7d2e9a7e82ec8545a91ab236 -> eba274a6f7421a30547c1fab6af7e69c881e144e7d2e9a7e82ec8545a91ab236; exit 0
- edit-25 packages/ui-solid/src/copy-shapes-options.test.ts: db93c107ba4e9a9dfcc85dea366808797e0d2e8cbc650970c42b28ab0ba8348f -> db93c107ba4e9a9dfcc85dea366808797e0d2e8cbc650970c42b28ab0ba8348f; exit 0
- edit-26 packages/ui-solid/src/CopyShapesDialog.tsx: 8122ccaff7fed9baec178c173d844c6482f9b6ef44526ac3d2ea727ff8a98873 -> 8122ccaff7fed9baec178c173d844c6482f9b6ef44526ac3d2ea727ff8a98873; exit 0
- edit-27 packages/ui-solid/src/CopyShapesDialog.css: 9747f0d0ae17edcafe92d0f7c9edf1344a1dd09a905306d73e771b6e86d03397 -> 9747f0d0ae17edcafe92d0f7c9edf1344a1dd09a905306d73e771b6e86d03397; exit 0
- edit-28 packages/ui-solid/src/PageTabs.tsx: dfec145e977ff0150e93edcb9b3ec2249dfdae4a941a403733a8bb2a96bc46c3 -> dfec145e977ff0150e93edcb9b3ec2249dfdae4a941a403733a8bb2a96bc46c3; exit 0

Final verification on moving shared tree:
- ui3: exit 0, 3 pass, 0 fail
- pagetabs3: exit 0, 5 pass, 0 fail
- typecheck3: exit 0
- biome3: exit 0
- protected diff: exit 0, empty

Prior typecheck initially failed on sibling-owned SlideAreaOverlay.tsx; a subsequent shared-tree rerun passed. Formal reviews and integration remain downstream.
