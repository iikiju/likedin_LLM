# LinkedIn 회사 분석기

LinkedIn 페이지에서 회사 정보를 빠르게 분석하여 연봉, 복지, 직무 적합도 등을 요약해주는 Chrome 확장 프로그램입니다.

## 기능

- LinkedIn 페이지의 회사 정보에 분석 버튼 추가
- 연봉 정보, 복지 정보, 직무 적합도 자동 분석
- 회사에 대한 종합 평가 및 별점 표시
- 오픈소스 LLM 기반 분석 (로컬 실행 또는 서버 연결)

## 설치 방법

1. https://ollama.ai/ -> ollama mac버전 설치
2. 설치 후 ollama list를 통해 현재 설치된 모델확인
3. 이번 프로젝트의 경우 모델은 mistral로 사용함 따라서
    3-1. ollama pull mistral
4. 모델 설치가 끝나면 serve를 해야함 4-1.참조 
    4-1. OLLAMA_ORIGINS="chrome-extension://*,http://localhost:*" ollama serve
    4-2. already run이라는 명령어가 나올 경우 실행중인 ollama프로그램을 종료해야함 mac의 경우 상단 바에서 라마 그림을 끌것!!!
5. chrome extension 개발자 모드를 켜고, 폴더를 업로드 한 다음 사용하면 됩니다.
## 추가 개발 계획

- 더 많은 회사 정보 수집 API 통합
- 회사 리뷰 데이터 분석 기능 추가
- 사용자 맞춤형 직무 추천 기능

## 라이센스

MIT License 
