# dogexam_cpt

반려견스타일리스트 3급 필기 문제 풀이 사이트입니다. 정적 HTML/CSS/JavaScript로 만들었으며 GitHub Pages에 배포합니다.

## 사이트 구성

- `site/`: GitHub Pages에 배포되는 사이트
- `site/data/chapter-1.json`: 1장 안전위생관리 98문항 (선택지 완비 94문항)
- `site/data/answers/chapter-1.json`: 1장 정답 데이터 자리
- `.github/workflows/deploy-pages.yml`: `main` 변경 시 GitHub Pages 자동 배포

문제 풀이 화면은 챕터의 모든 문항을 보여주고 답안을 브라우저에 저장합니다. 공식 정답 키가 제공되면 선택 즉시 정답·오답을 확인합니다. 원본에서 선택지가 빠진 문항은 비활성 상태로 표시됩니다.

전체 모의시험은 각 챕터에서 무작위 10문항씩, 총 60문항을 출제합니다. 총점 60점 이상이면서 모든 챕터에서 40% 이상 정답을 얻어야 합격으로 표시합니다. 현재 다른 챕터 자료와 정답 키가 준비되지 않아 전체 시험은 잠겨 있고, 1장 10문항 연습은 먼저 사용할 수 있습니다.

## 정답 데이터 추가

각 챕터의 정답 파일은 `site/data/answers/chapter-N.json`에 둡니다. 문항 ID를 키로 쓰고 선택지 라벨을 값으로 입력합니다.

```json
{
  "chapterNumber": 1,
  "answers": {
    "c1-q1": "③",
    "c1-q2": "⑤"
  }
}
```

문항 데이터의 `id`와 정확히 일치해야 합니다. 정답이 준비된 문제만 채점 및 모의시험 출제 대상에 포함됩니다. 챕터 2~6은 `site/data/chapter-N.json`과 대응하는 정답 파일을 추가하면 자동으로 나타납니다.

## GitHub Pages 설정

저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다. 이후 `main` 브랜치에 커밋이 올라오면 워크플로가 사이트를 배포합니다.

예상 주소: <https://seolhwa0107.github.io/dogexam_cpt/>

GitHub Pages로 제공되는 사이트와 데이터 파일은 공개 인터넷에서 볼 수 있습니다. 저장소가 비공개여도 페이지 방문자는 사이트 자료를 내려받을 수 있습니다. 비공개 저장소 Pages 이용 자격은 GitHub 플랜에 따라 달라질 수 있습니다.
