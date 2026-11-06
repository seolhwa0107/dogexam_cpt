# dogexam_cpt

CPT 시험 연습 사이트의 정적 페이지입니다. 현재는 기본 안내 화면만 들어 있으며 문제 자료는 아직 포함하지 않습니다.

## 구성

- \`site/\`: GitHub Pages에 배포되는 사이트 파일
- \`.github/workflows/deploy-pages.yml\`: \`main\` 브랜치에 변경 사항이 올라오면 사이트를 배포하는 GitHub Actions 워크플로

## 첫 배포 설정

저장소에서 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다. 설정 후 \`main\`에 커밋이 올라오면 자동으로 배포되고, Actions 탭에서 진행 상태와 사이트 주소를 확인할 수 있습니다.

예상 주소: <https://seolhwa0107.github.io/dogexam_cpt/>

## 문제 자료 추가 전 확인

GitHub Pages 사이트는 저장소가 비공개여도 공개 인터넷에서 볼 수 있습니다. CPT 문제와 해설을 추가하기 전에 웹사이트에 공개해도 되는 자료인지 확인해 주세요. 비공개 저장소에서 Pages를 사용하려면 GitHub Pro, Team, Enterprise 등 지원되는 플랜이 필요할 수 있습니다.

자세한 내용은 [GitHub Pages 공개 원본 설정 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)를 참고하세요.
