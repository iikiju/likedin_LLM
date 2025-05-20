document.addEventListener('DOMContentLoaded', () => {
  console.log('팝업 로드됨');
  
  // 도구 버튼 이벤트 리스너 추가
  document.getElementById('check-ollama').addEventListener('click', checkOllamaConnection);
  document.getElementById('use-js-prompt').addEventListener('click', () => switchPromptProfile('JS'));
  document.getElementById('use-sm-prompt').addEventListener('click', () => switchPromptProfile('SM'));
  document.getElementById('custom-profile-btn').addEventListener('click', toggleCustomProfileForm);
  document.getElementById('save-profile').addEventListener('click', saveCustomProfile);
  document.getElementById('cancel-profile').addEventListener('click', hideCustomProfileForm);
  
  // 현재 프롬프트 프로필 표시
  loadCurrentPromptProfile();
  
  // 커스텀 프로필 불러오기
  loadCustomProfileData();
  
  // 현재 탭의 URL 확인
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    console.log('현재 탭 URL:', url);
    
    // LinkedIn 페이지인지 확인
    if (url && url.includes('linkedin.com')) {
      // 페이지에서 회사 정보를 가져올 수 있는 상태인지 확인
      console.log('LinkedIn 페이지 확인됨, 회사 정보 요청 중...');
      
      try {
        chrome.tabs.sendMessage(
          currentTab.id, 
          { action: 'checkCompanyInfo' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('메시지 전송 오류:', chrome.runtime.lastError.message);
              showStatus('LinkedIn 페이지에서 회사 정보를 확인하세요. 페이지를 새로고침하거나 다른 LinkedIn 페이지를 시도해보세요.');
              return;
            }
            
            console.log('컨텐츠 스크립트 응답:', response);
            
            if (response && response.companiesInfo && response.companiesInfo.length > 0) {
              // 회사 목록 표시
              showCompanyList(response.companiesInfo, currentTab.id);
            } else {
              showStatus('LinkedIn 페이지에서 회사 정보를 찾을 수 없습니다. 회사 프로필이나 채용 공고 페이지를 방문해보세요.');
            }
          }
        );
      } catch (error) {
        console.error('메시지 전송 중 예외 발생:', error);
        showStatus('LinkedIn 페이지와의 통신 중 오류가 발생했습니다. 페이지를 새로고침하고 다시 시도해보세요.');
      }
    } else {
      showStatus('LinkedIn 페이지에서 익스텐션을 실행하세요.');
    }
  });
});

// 회사 목록 표시
function showCompanyList(companies, tabId) {
  console.log('회사 목록 표시:', companies);
  
  // company-info 요소 비우기
  const companyInfoElement = document.getElementById('company-info');
  companyInfoElement.innerHTML = '';
  companyInfoElement.classList.remove('hidden');
  
  // 에러 메시지 숨기기
  document.getElementById('error-container').classList.add('hidden');
  
  // 제목 추가
  const titleElement = document.createElement('h3');
  titleElement.textContent = '<Select a company to analyze>';
  titleElement.style.marginBottom = '10px';
  companyInfoElement.appendChild(titleElement);
  
  // 회사가 없으면 메시지 표시
  if (!companies || companies.length === 0) {
    const messageElement = document.createElement('p');
    messageElement.className = 'status-message';
    messageElement.textContent = '회사 정보를 찾을 수 없습니다.';
    companyInfoElement.appendChild(messageElement);
    return;
  }
  
  // 회사 목록 생성
  const listElement = document.createElement('ul');
  listElement.className = 'company-list';
  listElement.style.listStyle = 'none';
  listElement.style.padding = '0';
  listElement.style.margin = '0';
  
  companies.forEach((company, index) => {
    const listItem = document.createElement('li');
    listItem.style.padding = '8px 0';
    listItem.style.borderBottom = '1px solid #eee';
    listItem.style.cursor = 'pointer';
    listItem.style.display = 'flex';
    listItem.style.justifyContent = 'space-between';
    listItem.style.alignItems = 'center';
    
    // 회사 정보 컨테이너
    const infoContainer = document.createElement('div');
    
    // 회사명
    const nameElement = document.createElement('div');
    nameElement.textContent = company.name;
    nameElement.style.fontWeight = 'bold';
    infoContainer.appendChild(nameElement);
    
    // 산업 정보가 있으면 표시
    if (company.industry) {
      const industryElement = document.createElement('div');
      industryElement.textContent = company.industry;
      industryElement.style.fontSize = '12px';
      industryElement.style.color = '#666';
      infoContainer.appendChild(industryElement);
    }
    
    listItem.appendChild(infoContainer);
    
    // 분석 버튼
    const analyzeButton = document.createElement('button');
    analyzeButton.textContent = '분석';
    analyzeButton.style.backgroundColor = '#0077b5';
    analyzeButton.style.color = 'white';
    analyzeButton.style.border = 'none';
    analyzeButton.style.borderRadius = '4px';
    analyzeButton.style.padding = '4px 8px';
    analyzeButton.style.fontSize = '12px';
    analyzeButton.style.cursor = 'pointer';
    
    // 버튼 컨테이너
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.appendChild(analyzeButton);
    
    // 분석 버튼 클릭 이벤트
    analyzeButton.addEventListener('click', () => {
      // 선택된 회사 분석 시작
      showLoading();
      
      // 컨텐츠 스크립트에 특정 회사 분석 요청
      chrome.tabs.sendMessage(
        tabId,
        { action: 'analyzeSelectedCompany', companyName: company.name },
        (response) => {
          if (response && response.success && response.companyInfo) {
            // 백그라운드 스크립트에 분석 요청
            analyzeCompany(response.companyInfo);
          } else {
            showError('회사 정보를 찾을 수 없습니다.');
          }
        }
      );
    });
    
    listItem.appendChild(buttonContainer);
    listElement.appendChild(listItem);
  });
  
  companyInfoElement.appendChild(listElement);
  
  // 분석 결과 및 로딩 숨기기
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
}

// Ollama 연결 상태 확인
async function checkOllamaConnection() {
  try {
    showStatus('LLM Connection Checking...');
    document.getElementById('error-container').classList.add('hidden');
    
    // 먼저 간단한 HEAD 요청으로 서버가 실행 중인지 확인
    const pingResponse = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      }
    }).catch(error => {
      console.error('Ping 요청 실패:', error);
      showError('LLM Server Connection Failed: ' + error.message);
      return null;
    });
    
    if (pingResponse && pingResponse.ok) {
      const data = await pingResponse.json();
      console.log('Ollama 서버 태그 정보:', data);
      
      // 모델 리스트 표시
      let modelList = '사용 가능한 모델: ';
      if (data && data.models && data.models.length > 0) {
        modelList += data.models.map(m => m.name).join(', ');
      } else {
        modelList += '모델 정보 없음';
      }
      
      // qwen3 모델이 있는지 확인
      const hasQwen3 = data.models && data.models.some(m => m.name === 'qwen3:8b');
      if (!hasQwen3) {
        showError('Qwen3:8b 모델이 설치되어 있지 않습니다. 다음 명령어로 설치하세요: ollama pull qwen3:8b');
        showStatus('Ollama 서버는 실행 중이지만 Qwen3:8b 모델이 필요합니다.');
        return;
      }
      
      // 서버가 응답하면 모델 테스트
      const testMessage = '이것은 Ollama API 연결 테스트입니다.';
      const requestTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('요청 타임아웃')), 100000)
      );
      
      const modelResponse = await Promise.race([
        fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'qwen3:8b',
            prompt: testMessage,
            stream: false,
            options: {
              temperature: 0.7,
              top_p: 0.9,
              top_k: 40,
              num_ctx: 8192,
              num_thread: 4,
              repeat_penalty: 1.1
            }
          }),
        }),
        requestTimeout
      ]);
      
      if (modelResponse.ok) {
        const responseData = await modelResponse.json();
        console.log('Ollama API 응답:', responseData);
        showStatus('Ollama 연결 성공! 분석 준비가 완료되었습니다.<br>' + modelList);
      } else {
        const errorText = await modelResponse.text();
        console.error('Ollama API 오류 응답:', errorText);
        showError(`Ollama API 오류 (${modelResponse.status}): ${modelResponse.statusText}`);
        showStatus('Ollama 서버에 연결할 수 있지만 응답이 올바르지 않습니다. 모델이 로드되었는지 확인하세요.');
      }
    } else if (pingResponse) {
      showError(`Ollama API 오류 (${pingResponse.status}): ${pingResponse.statusText}`);
      showStatus('Ollama 서버 연결 실패. 서버가 실행 중인지 확인하세요. 서버 재시작 방법: ollama serve');
    } else {
      showStatus('Ollama 서버 연결 실패. 서버가 실행 중인지 확인하세요.');
    }
  } catch (error) {
    console.error('Ollama 연결 오류:', error);
    showError('Ollama 연결 오류: ' + error.message);
    showStatus('Ollama 연결 실패. CORS 오류일 수 있습니다. 확장 프로그램을 재로드하고 다시 시도하세요.');
  }
}

// 에러 메시지 표시
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  errorContainer.textContent = message;
  errorContainer.classList.remove('hidden');
}

// 상태 메시지 표시
function showStatus(message) {
  console.log('상태 메시지:', message);
  
  // company-info 요소 내용 설정
  const companyInfoElement = document.getElementById('company-info');
  companyInfoElement.innerHTML = `<div class="status-message">${message}</div>`;
  companyInfoElement.classList.remove('hidden');
  
  // 다른 요소 숨기기
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
}

// 로딩 화면 표시
function showLoading() {
  console.log('로딩 화면 표시');
  document.getElementById('company-info').classList.add('hidden');
  document.getElementById('analysis-result').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  
  const loadingElement = document.getElementById('loading');
  loadingElement.innerHTML = '<div class="spinner"></div><p>Analyzing...</p>';
  loadingElement.classList.remove('hidden');
}

// 분석 결과 표시
function showAnalysisResult(data) {
  console.log('분석 결과 표시:', data);
  document.getElementById('company-info').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('error-container').classList.add('hidden');
  
  const resultContainer = document.getElementById('analysis-result');
  resultContainer.classList.remove('hidden');
  
  // 회사 정보 업데이트
  document.getElementById('company-name').textContent = data.name;
  document.getElementById('salary-info').textContent = data.salary || '정보 없음';
  document.getElementById('benefits-info').textContent = data.benefits || '정보 없음';
  document.getElementById('job-fit-info').textContent = data.jobFit || '정보 없음';
  document.getElementById('rating-text').textContent = data.summary || '정보 없음';
  
  // 별점 업데이트
  updateStars(data.rating || 0);
  
  // "돌아가기" 버튼 추가
  if (!document.querySelector('.back-to-list-btn')) {
    const backBtn = document.createElement('button');
    backBtn.textContent = 'back to list';
    backBtn.className = 'back-to-list-btn';
    backBtn.style.marginTop = '12px';
    
    backBtn.addEventListener('click', () => {
      // 현재 탭에서 다시 회사 정보 요청
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          { action: 'checkCompanyInfo' },
          (response) => {
            if (response && response.companiesInfo) {
              showCompanyList(response.companiesInfo, tabs[0].id);
            } else {
              showStatus('Company info not found.');
            }
          }
        );
      });
    });
    
    resultContainer.appendChild(backBtn);
  }
}

// 별점 표시 업데이트
function updateStars(rating) {
  console.log('별점 업데이트:', rating);
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    const starRating = parseInt(star.getAttribute('data-rating'));
    if (starRating <= rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// 회사 분석 요청
function analyzeCompany(companyInfo) {
  console.log('회사 분석 요청:', companyInfo);
  
  // 백그라운드 스크립트에 분석 요청
  chrome.runtime.sendMessage(
    { action: 'analyzeCompany', companyInfo },
    (response) => {
      console.log('분석 응답 수신:', response);
      if (response && response.success) {
        showAnalysisResult(response.data);
      } else {
        console.error('분석 오류:', response);
        showError('분석 오류: ' + (response?.error || '알 수 없는 오류'));
      }
    }
  );
}

// 커스텀 프로필 폼 토글
function toggleCustomProfileForm() {
  const form = document.getElementById('custom-profile-form');
  if (form.classList.contains('hidden')) {
    form.classList.remove('hidden');
  } else {
    form.classList.add('hidden');
  }
}

// 커스텀 프로필 폼 숨기기
function hideCustomProfileForm() {
  document.getElementById('custom-profile-form').classList.add('hidden');
}

// 커스텀 프로필 저장
function saveCustomProfile() {
  const customProfile = {
    name: document.getElementById('custom-name').value,
    age: document.getElementById('custom-age').value,
    location: document.getElementById('custom-location').value,
    major: document.getElementById('custom-major').value,
    field: document.getElementById('custom-field').value,
    salary: document.getElementById('custom-salary').value,
    workType: document.getElementById('custom-worktype').value,
    skills: document.getElementById('custom-skills').value
  };
  
  // 저장
  chrome.storage.local.set({ 'customProfile': customProfile }, () => {
    console.log('커스텀 프로필 저장됨:', customProfile);
    
    // 커스텀 프로필을 현재 프로필로 설정
    chrome.storage.local.set({ 'promptProfile': 'CUSTOM' }, () => {
      updatePromptButtonStyles('CUSTOM');
      hideCustomProfileForm();
      showStatus(`커스텀 프로필 "${customProfile.name}" (${customProfile.age}세)로 설정되었습니다.`);
    });
  });
}

// 커스텀 프로필 데이터 로드
function loadCustomProfileData() {
  chrome.storage.local.get('customProfile', (data) => {
    if (data.customProfile) {
      // 폼에 데이터 채우기
      document.getElementById('custom-name').value = data.customProfile.name || '';
      document.getElementById('custom-age').value = data.customProfile.age || '';
      document.getElementById('custom-location').value = data.customProfile.location || '';
      document.getElementById('custom-major').value = data.customProfile.major || '';
      document.getElementById('custom-field').value = data.customProfile.field || '';
      document.getElementById('custom-salary').value = data.customProfile.salary || '';
      document.getElementById('custom-worktype').value = data.customProfile.workType || 'full';
      document.getElementById('custom-skills').value = data.customProfile.skills || '';
    }
  });
}

// 프롬프트 프로필 전환 함수
function switchPromptProfile(profile) {
  chrome.storage.local.set({ 'promptProfile': profile }, () => {
    console.log(`Prompt profile switched to: ${profile}`);
    
    let displayName = '';
    if (profile === 'JS') {
      displayName = 'JeoungSu (32M, Developer)';
    } else if (profile === 'SM') {
      displayName = 'SuMin (25F, Marketing)';
    } else if (profile === 'CUSTOM') {
      chrome.storage.local.get('customProfile', (data) => {
        if (data.customProfile) {
          displayName = `${data.customProfile.name} (${data.customProfile.age}세)`;
        } else {
          displayName = '커스텀 프로필 (설정 필요)';
        }
        showStatus(`Persona switched to: ${displayName}`);
      });
      updatePromptButtonStyles(profile);
      return;
    }
    
    showStatus(`Persona switched to: ${displayName}`);
    
    // 버튼 스타일 업데이트
    updatePromptButtonStyles(profile);
  });
}

// 현재 프롬프트 프로필 로드
function loadCurrentPromptProfile() {
  chrome.storage.local.get('promptProfile', (data) => {
    const profile = data.promptProfile || 'JS'; // 기본값: JS
    console.log(`Current prompt profile: ${profile}`);
    updatePromptButtonStyles(profile);
  });
}

// 프롬프트 버튼 스타일 업데이트
function updatePromptButtonStyles(activeProfile) {
  const jsButton = document.getElementById('use-js-prompt');
  const smButton = document.getElementById('use-sm-prompt');
  const customButton = document.getElementById('custom-profile-btn');
  
  // 모든 버튼 기본 스타일
  jsButton.style.backgroundColor = '#0077b5';
  smButton.style.backgroundColor = '#0077b5';
  customButton.style.backgroundColor = '#0077b5';
  
  // 활성 버튼 스타일
  if (activeProfile === 'JS') {
    jsButton.style.backgroundColor = '#4caf50';
  } else if (activeProfile === 'SM') {
    smButton.style.backgroundColor = '#4caf50';
  } else if (activeProfile === 'CUSTOM') {
    customButton.style.backgroundColor = '#4caf50';
  }
} 