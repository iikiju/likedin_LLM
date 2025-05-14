# LinkedIn 회사 분석기

LinkedIn 페이지에서 회사 정보를 빠르게 분석하여 연봉, 복지, 직무 적합도 등을 요약해주는 Chrome 확장 프로그램입니다.

## 기능

- LinkedIn 페이지의 회사 정보에 분석 버튼 추가
- 연봉 정보, 복지 정보, 직무 적합도 자동 분석
- 회사에 대한 종합 평가 및 별점 표시
- 오픈소스 LLM 기반 분석 (로컬 실행 또는 서버 연결)

## 설치 방법

### 1. 확장 프로그램 설치

1. `chrome://extensions/` 페이지에 접속
2. 개발자 모드 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 버튼 클릭
4. 이 프로젝트 폴더 선택

### 2. 로컬 LLM 설정 (선택 사항)

기본적으로 이 확장 프로그램은 모의 데이터를 사용하여 작동합니다. 실제 LLM을 사용하려면:

1. Ollama 설치: https://ollama.ai/
2. Llama2 모델 다운로드: `ollama pull llama2`
3. Ollama 서버 실행: `ollama serve`

### 3. CORS 설정 (중요)

Chrome 확장 프로그램이 로컬 Ollama API에 접근하기 위해 CORS 설정이 필요합니다:

#### Mac/Linux 사용자:
```bash
# Ollama 서버를 중지하고, 환경 변수 설정 후 재시작 -> 만약 상단탭에 llama그림이 실행중이라면 종료할 것!!!!!!!
killall ollama
OLLAMA_ORIGINS="chrome-extension://*,http://localhost:*" ollama serve
```

#### Windows 사용자:
```powershell
# PowerShell에서 실행
$env:OLLAMA_ORIGINS="chrome-extension://*,http://localhost:*"
ollama serve
```

만약 CORS 관련 403 오류가 계속 발생한다면:
1. Ollama 서버가 실행 중인지 확인 (http://localhost:11434/ 접속)
2. 확장 프로그램을 다시 로드: Chrome 확장 관리 페이지에서 새로고침 버튼 클릭
3. 크롬 브라우저를 완전히 재시작

## 사용 방법

1. LinkedIn에서 회사 페이지나 채용 공고를 열기
2. 회사 이름 옆에 나타나는 "분석" 버튼 클릭
3. 분석 결과 확인

## 문제 해결

### Ollama API 오류 (403, 연결 거부 등)
- Ollama 서버가 실행 중인지 확인
- `OLLAMA_ORIGINS` 환경 변수가 올바르게 설정되었는지 확인
- 브라우저와 확장 프로그램을 재시작
- 로컬 방화벽 설정 확인

### 모델이 로드되지 않는 경우
- `ollama list` 명령어로 모델이 설치되었는지 확인
- `ollama pull llama2` 명령어로 모델을 다시 다운로드
- 충분한 디스크 공간과 메모리 확인

## 개발 환경 설정

```bash
# 프로젝트 폴더로 이동
cd linkedin_LLM

# 아이콘 폴더 생성
mkdir -p icons
```

## 커스터마이징

### 다른 LLM 모델 사용

`background.js` 파일에서 다음 부분을 수정하세요:

```javascript
// LLM API 호출 (로컬 LLM 모델 사용)
async function callLLMApi(companyInfo, companyData) {
  // 로컬 LLM API URL (실제 URL로 변경 필요)
  const apiUrl = 'http://localhost:11434/api/generate';
  
  // 모델 이름 변경
  body: JSON.stringify({
    model: 'llama2', // 사용할 모델명 (변경 가능)
    prompt: prompt,
    stream: false
  }),
}
```

## 추가 개발 계획

- 더 많은 회사 정보 수집 API 통합
- 회사 리뷰 데이터 분석 기능 추가
- 사용자 맞춤형 직무 추천 기능

## 라이센스

MIT License 
